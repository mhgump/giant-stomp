#!/usr/bin/env python3

from __future__ import annotations

import copy
import json
import struct
import sys
from dataclasses import dataclass
from pathlib import Path


"""
merge_textures.py anim.glb tex.glb out.glb

Merges materials/textures/images/samplers from tex.glb into anim.glb and assigns
materials onto anim.glb mesh primitives based on matching mesh “signatures”
(primitive count + accessor shapes) and primitive indices.

Assumptions (single documented behavior contract):
- Both inputs are GLB files with exactly one buffer: `buffers[0]`.
- `anim.glb` already has the rig/animations/geometry, but has no texture pipeline:
  `materials`, `textures`, `images`, `samplers` must be absent or empty.
- `tex.glb` contains the desired `materials`/`textures`/`images`/`samplers`, and
  every mesh primitive has a `material` assigned.
- Mesh mapping is by mesh signature (not names). Each anim mesh must have
  exactly one corresponding tex mesh with the same signature, and they must
  have the same number of primitives.
- If mesh names are present and uniquely match, name matches are used first and
  remaining meshes are matched by signature.
- If both files contain exactly one mesh, that single mesh is matched even if
  signatures differ.
- In the single-mesh case, `TEXCOORD_0` is taken from `tex.glb` (as long as the
  vertex count matches) so the copied texture matches the UVs.
- `tex.glb` images are either:
  - embedded via `images[i].bufferView` into the BIN chunk, or
  - external via `images[i].uri` (these are preserved as-is).

If any assumption fails, this script raises and stops.
"""


GLB_MAGIC = b"glTF"
CHUNK_JSON = b"JSON"
CHUNK_BIN = b"BIN\x00"


@dataclass(frozen=True)
class Glb:
  json: dict
  bin: bytes


def _pad4(data: bytes, pad_byte: int) -> bytes:
  rem = len(data) % 4
  if rem == 0:
    return data
  return data + bytes([pad_byte]) * (4 - rem)


def read_glb(path: Path) -> Glb:
  buf = path.read_bytes()

  if len(buf) < 12:
    raise ValueError(f"{path}: too small to be a GLB")

  magic, version, total_len = struct.unpack_from("<4sII", buf, 0)
  if magic != GLB_MAGIC:
    raise ValueError(f"{path}: bad magic {magic!r}")
  if total_len != len(buf):
    raise ValueError(f"{path}: header length {total_len} != file length {len(buf)}")

  json_obj: dict | None = None
  bin_chunk = b""

  offset = 12
  while offset < len(buf):
    if offset + 8 > len(buf):
      raise ValueError(f"{path}: truncated chunk header")
    chunk_len, chunk_type = struct.unpack_from("<I4s", buf, offset)
    chunk_start = offset + 8
    chunk_end = chunk_start + chunk_len
    if chunk_end > len(buf):
      raise ValueError(f"{path}: truncated chunk payload")

    if chunk_type == CHUNK_JSON:
      json_text = buf[chunk_start:chunk_end].decode("utf-8")
      json_obj = json.loads(json_text)
    elif chunk_type == CHUNK_BIN:
      bin_chunk = bytes(buf[chunk_start:chunk_end])

    offset = chunk_end

  if json_obj is None:
    raise ValueError(f"{path}: missing JSON chunk")

  return Glb(json=json_obj, bin=bin_chunk)


def write_glb(path: Path, glb: Glb) -> None:
  json_bytes = json.dumps(glb.json, separators=(",", ":"), ensure_ascii=False).encode(
    "utf-8"
  )
  json_bytes = _pad4(json_bytes, pad_byte=0x20)

  bin_bytes = _pad4(glb.bin, pad_byte=0x00)

  chunks = []
  chunks.append(struct.pack("<I4s", len(json_bytes), CHUNK_JSON) + json_bytes)
  if len(bin_bytes) > 0:
    chunks.append(struct.pack("<I4s", len(bin_bytes), CHUNK_BIN) + bin_bytes)

  total_len = 12 + sum(len(c) for c in chunks)
  header = struct.pack("<4sII", GLB_MAGIC, 2, total_len)
  path.write_bytes(header + b"".join(chunks))


def _require_one_buffer(doc: dict, label: str) -> None:
  buffers = doc.get("buffers")
  if not isinstance(buffers, list) or len(buffers) != 1:
    raise ValueError(f"{label}: expected exactly 1 buffer")


def _require_empty_texture_pipeline(anim: dict) -> None:
  for k in ("materials", "textures", "images", "samplers"):
    if k in anim and anim[k] != []:
      raise ValueError(f"anim.glb: expected {k} to be absent or empty")


def _require_meshes(doc: dict, label: str) -> list[dict]:
  meshes = doc.get("meshes")
  if not isinstance(meshes, list):
    raise ValueError(f"{label}: missing meshes[]")
  return meshes


def _require_accessors(doc: dict, label: str) -> list[dict]:
  accessors = doc.get("accessors")
  if not isinstance(accessors, list):
    raise ValueError(f"{label}: missing accessors[]")
  return accessors


def _accessor_sig(accessors: list[dict], index: int) -> tuple:
  a = accessors[index]
  count = a.get("count")
  typ = a.get("type")
  component_type = a.get("componentType")
  normalized = bool(a.get("normalized", False))
  if not isinstance(count, int) or not isinstance(typ, str) or not isinstance(
    component_type, int
  ):
    raise ValueError("accessor: missing required fields (count/type/componentType)")
  return (count, typ, component_type, normalized)


def _prim_sig(accessors: list[dict], prim: dict) -> tuple:
  mode = int(prim.get("mode", 4))

  indices = prim.get("indices")
  indices_sig = None
  if indices is not None:
    if not isinstance(indices, int):
      raise ValueError("primitive.indices must be an int when present")
    indices_sig = _accessor_sig(accessors, indices)

  attrs = prim.get("attributes")
  if not isinstance(attrs, dict):
    raise ValueError("primitive.attributes missing or not a dict")

  attr_sigs = []
  for k in sorted(attrs.keys()):
    idx = attrs[k]
    if not isinstance(idx, int):
      raise ValueError(f"primitive.attributes.{k} must be an int accessor index")
    attr_sigs.append((k, _accessor_sig(accessors, idx)))

  targets = prim.get("targets")
  target_sigs = None
  if targets is not None:
    if not isinstance(targets, list):
      raise ValueError("primitive.targets must be a list when present")
    target_sigs = []
    for t in targets:
      if not isinstance(t, dict):
        raise ValueError("primitive.targets entries must be dicts")
      t_sigs = []
      for k in sorted(t.keys()):
        idx = t[k]
        if not isinstance(idx, int):
          raise ValueError(f"primitive.targets.{k} must be an int accessor index")
        t_sigs.append((k, _accessor_sig(accessors, idx)))
      target_sigs.append(tuple(t_sigs))
    target_sigs = tuple(target_sigs)

  return (mode, indices_sig, tuple(attr_sigs), target_sigs)


def _mesh_sig(accessors: list[dict], mesh: dict) -> tuple:
  prims = mesh.get("primitives")
  if not isinstance(prims, list):
    raise ValueError("mesh.primitives missing or not a list")
  return tuple(_prim_sig(accessors, p) for p in prims)


def _mesh_name(mesh: dict) -> str | None:
  name = mesh.get("name")
  if name is None:
    return None
  if not isinstance(name, str):
    raise ValueError("mesh.name must be a string when present")
  if name == "":
    return None
  return name


def _mesh_debug_list(
  meshes: list[dict], accessors: list[dict]
) -> list[tuple[int, str | None, int, int | None, bool]]:
  out = []
  for i, m in enumerate(meshes):
    prims = m.get("primitives")
    if not isinstance(prims, list):
      raise ValueError("mesh.primitives missing or not a list")

    vertex_count = None
    has_uv0 = False
    if len(prims) > 0 and isinstance(prims[0], dict):
      attrs = prims[0].get("attributes")
      if isinstance(attrs, dict):
        pos = attrs.get("POSITION")
        if isinstance(pos, int):
          c = accessors[pos].get("count")
          if isinstance(c, int):
            vertex_count = c
        has_uv0 = isinstance(attrs.get("TEXCOORD_0"), int)

    out.append((i, _mesh_name(m), len(prims), vertex_count, has_uv0))
  return out


def _print_mesh_debug(
  anim_meshes: list[dict],
  tex_meshes: list[dict],
  anim_accessors: list[dict],
  tex_accessors: list[dict],
) -> None:
  print("anim.glb meshes (index, name, primitiveCount, vertexCount, hasUV0):", file=sys.stderr)
  for idx, name, prim_count, vtx_count, has_uv0 in _mesh_debug_list(
    anim_meshes, anim_accessors
  ):
    print(
      f"  {idx}: {name!r} prims={prim_count} verts={vtx_count} uv0={has_uv0}",
      file=sys.stderr,
    )
  print("tex.glb meshes (index, name, primitiveCount, vertexCount, hasUV0):", file=sys.stderr)
  for idx, name, prim_count, vtx_count, has_uv0 in _mesh_debug_list(
    tex_meshes, tex_accessors
  ):
    print(
      f"  {idx}: {name!r} prims={prim_count} verts={vtx_count} uv0={has_uv0}",
      file=sys.stderr,
    )


def _element_size_bytes(component_type: int, accessor_type: str) -> int:
  comp_size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}.get(
    component_type
  )
  if comp_size is None:
    raise ValueError(f"unsupported componentType {component_type}")
  type_count = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
  }.get(accessor_type)
  if type_count is None:
    raise ValueError(f"unsupported accessor type {accessor_type!r}")
  return comp_size * type_count


def _extract_accessor_bytes(doc: dict, bin_chunk: bytes, accessor_index: int) -> bytes:
  accessors = doc.get("accessors")
  if not isinstance(accessors, list):
    raise ValueError("missing accessors[]")
  buffer_views = doc.get("bufferViews")
  if not isinstance(buffer_views, list):
    raise ValueError("missing bufferViews[]")

  acc = accessors[accessor_index]
  if "sparse" in acc:
    raise ValueError("sparse accessors are not supported")
  if "bufferView" not in acc:
    raise ValueError("accessor.bufferView is required for this script")

  count = acc.get("count")
  accessor_type = acc.get("type")
  component_type = acc.get("componentType")
  if not isinstance(count, int) or not isinstance(accessor_type, str) or not isinstance(
    component_type, int
  ):
    raise ValueError("accessor missing required fields (count/type/componentType)")

  elem_size = _element_size_bytes(component_type, accessor_type)
  bv = buffer_views[int(acc["bufferView"])]
  if bv.get("buffer") != 0:
    raise ValueError("expected accessor bufferViews to reference buffer 0")

  bv_off = int(bv.get("byteOffset", 0))
  acc_off = int(acc.get("byteOffset", 0))
  stride = bv.get("byteStride")
  if stride is None:
    stride = elem_size
  stride = int(stride)

  start = bv_off + acc_off
  if stride == elem_size:
    end = start + count * elem_size
    return bytes(bin_chunk[start:end])

  out = bytearray()
  for i in range(count):
    o = start + i * stride
    out.extend(bin_chunk[o : o + elem_size])
  return bytes(out)


def merge_textures(anim_glb: Glb, tex_glb: Glb) -> Glb:
  anim = copy.deepcopy(anim_glb.json)
  tex = copy.deepcopy(tex_glb.json)

  _require_one_buffer(anim, "anim.glb")
  _require_one_buffer(tex, "tex.glb")
  _require_empty_texture_pipeline(anim)

  tex_materials = tex.get("materials")
  tex_textures = tex.get("textures")
  tex_images = tex.get("images")
  tex_samplers = tex.get("samplers")

  if not isinstance(tex_materials, list) or len(tex_materials) == 0:
    raise ValueError("tex.glb: expected non-empty materials[]")
  if not isinstance(tex_textures, list):
    raise ValueError("tex.glb: expected textures[] (possibly empty)")
  if not isinstance(tex_images, list):
    raise ValueError("tex.glb: expected images[] (possibly empty)")
  if not isinstance(tex_samplers, list):
    raise ValueError("tex.glb: expected samplers[] (possibly empty)")

  anim_meshes = _require_meshes(anim, "anim.glb")
  tex_meshes = _require_meshes(tex, "tex.glb")
  anim_accessors = _require_accessors(anim, "anim.glb")
  tex_accessors = _require_accessors(tex, "tex.glb")

  _print_mesh_debug(anim_meshes, tex_meshes, anim_accessors, tex_accessors)

  if len(anim_meshes) == 1 and len(tex_meshes) == 1:
    mesh_index_map = {0: 0}
    mesh_index_map_mode = {0: "single-mesh"}
    used_tex_indexes = {0}
    print("mesh mapping (animIndex -> texIndex, mode):", file=sys.stderr)
    print("  0 -> 0 (single-mesh)", file=sys.stderr)
  else:
    tex_name_to_index: dict[str, int] = {}
    tex_has_duplicate_names = False
    for i, m in enumerate(tex_meshes):
      n = _mesh_name(m)
      if n is None:
        continue
      if n in tex_name_to_index:
        tex_has_duplicate_names = True
        break
      tex_name_to_index[n] = i

    mesh_index_map = {}
    mesh_index_map_mode = {}
    used_tex_indexes = set()

    if not tex_has_duplicate_names:
      anim_has_duplicate_names = False
      seen_anim_names: set[str] = set()
      for m in anim_meshes:
        n = _mesh_name(m)
        if n is None:
          continue
        if n in seen_anim_names:
          anim_has_duplicate_names = True
          break
        seen_anim_names.add(n)

      if not anim_has_duplicate_names:
        for i, m in enumerate(anim_meshes):
          n = _mesh_name(m)
          if n is None:
            continue
          tex_i = tex_name_to_index.get(n)
          if tex_i is None:
            continue
          if _mesh_sig(anim_accessors, m) != _mesh_sig(tex_accessors, tex_meshes[tex_i]):
            raise ValueError(
              f"name-matched meshes have different signatures: anim mesh index {i} name={n!r} vs tex mesh index {tex_i}"
            )
          mesh_index_map[i] = tex_i
          mesh_index_map_mode[i] = "name"
          used_tex_indexes.add(tex_i)

    tex_by_sig: dict[tuple, list[int]] = {}
    for i, m in enumerate(tex_meshes):
      if i in used_tex_indexes:
        continue
      sig = _mesh_sig(tex_accessors, m)
      tex_by_sig.setdefault(sig, []).append(i)

    for i, anim_mesh in enumerate(anim_meshes):
      if i in mesh_index_map:
        continue
      sig = _mesh_sig(anim_accessors, anim_mesh)
      matches = tex_by_sig.get(sig, [])
      anim_name = _mesh_name(anim_mesh)
      if len(matches) != 1:
        if len(matches) == 0:
          raise ValueError(
            f"tex.glb: no mesh matches anim mesh index {i} name={anim_name!r}"
          )
        match_names = [_mesh_name(tex_meshes[j]) for j in matches]
        raise ValueError(
          f"tex.glb: ambiguous mesh matches for anim mesh index {i} name={anim_name!r}: tex mesh indexes {matches} names {match_names}"
        )
      mesh_index_map[i] = matches[0]
      mesh_index_map_mode[i] = "signature"
      used_tex_indexes.add(matches[0])

    print("mesh mapping (animIndex -> texIndex, mode):", file=sys.stderr)
    for anim_i in sorted(mesh_index_map.keys()):
      print(
        f"  {anim_i} -> {mesh_index_map[anim_i]} ({mesh_index_map_mode[anim_i]})",
        file=sys.stderr,
      )

  for anim_mesh_index, tex_mesh_index in mesh_index_map.items():
    anim_mesh = anim_meshes[anim_mesh_index]
    tex_mesh = tex_meshes[tex_mesh_index]

    anim_prims = anim_mesh["primitives"]
    tex_prims = tex_mesh["primitives"]
    if len(anim_prims) != len(tex_prims):
      raise ValueError(
        f"mesh primitive count mismatch animMeshIndex={anim_mesh_index} texMeshIndex={tex_mesh_index}"
      )

    for i, (anim_prim, tex_prim) in enumerate(zip(anim_prims, tex_prims, strict=True)):
      if "material" not in tex_prim:
        raise ValueError(
          f"tex.glb: meshIndex={tex_mesh_index} primitive {i} missing material"
        )
      anim_prim["material"] = tex_prim["material"]

  anim_buffer_views = anim.get("bufferViews")
  if anim_buffer_views is None:
    anim_buffer_views = []
  if not isinstance(anim_buffer_views, list):
    raise ValueError("anim.glb: bufferViews must be a list if present")

  tex_buffer_views = tex.get("bufferViews")
  if tex_images and tex_buffer_views is None:
    raise ValueError("tex.glb: images present but bufferViews missing")
  if tex_buffer_views is None:
    tex_buffer_views = []
  if not isinstance(tex_buffer_views, list):
    raise ValueError("tex.glb: bufferViews must be a list if present")

  combined_bin = bytearray(anim_glb.bin)
  new_buffer_views: list[dict] = []
  buffer_view_map: dict[int, int] = {}

  def append_buffer_view(data: bytes, target: int | None) -> int:
    pad = (-len(combined_bin)) % 4
    if pad:
      combined_bin.extend(b"\x00" * pad)

    byte_offset = len(combined_bin)
    combined_bin.extend(data)

    bv: dict = {"buffer": 0, "byteOffset": byte_offset, "byteLength": len(data)}
    if target is not None:
      bv["target"] = target

    new_index = len(anim_buffer_views) + len(new_buffer_views)
    new_buffer_views.append(bv)
    return new_index

  def copy_image_buffer_view(old_bv_index: int) -> int:
    if old_bv_index in buffer_view_map:
      return buffer_view_map[old_bv_index]

    old = tex_buffer_views[old_bv_index]
    if old.get("buffer") != 0:
      raise ValueError("tex.glb: expected image bufferViews to reference buffer 0")

    old_offset = int(old.get("byteOffset", 0))
    old_length = int(old["byteLength"])
    chunk = tex_glb.bin[old_offset : old_offset + old_length]
    if len(chunk) != old_length:
      raise ValueError("tex.glb: image bufferView points outside BIN chunk")

    new_index = append_buffer_view(chunk, target=None)
    buffer_view_map[old_bv_index] = new_index
    return new_index

  for anim_mesh_index, tex_mesh_index in mesh_index_map.items():
    if mesh_index_map_mode.get(anim_mesh_index) != "single-mesh":
      continue

    anim_mesh = anim_meshes[anim_mesh_index]
    tex_mesh = tex_meshes[tex_mesh_index]

    anim_prims = anim_mesh.get("primitives")
    tex_prims = tex_mesh.get("primitives")
    if not isinstance(anim_prims, list) or not isinstance(tex_prims, list):
      raise ValueError("single-mesh: missing primitives[]")
    if len(anim_prims) != len(tex_prims):
      raise ValueError(
        f"single-mesh: primitive count mismatch anim={len(anim_prims)} tex={len(tex_prims)}"
      )

    for prim_index, (anim_prim, tex_prim) in enumerate(
      zip(anim_prims, tex_prims, strict=True)
    ):
      anim_attrs = anim_prim.get("attributes")
      tex_attrs = tex_prim.get("attributes")
      if not isinstance(anim_attrs, dict) or not isinstance(tex_attrs, dict):
        raise ValueError("single-mesh: primitive.attributes missing or not a dict")

      anim_pos_acc = anim_attrs.get("POSITION")
      if not isinstance(anim_pos_acc, int):
        raise ValueError("single-mesh: anim POSITION accessor missing")
      anim_vertex_count = int(anim_accessors[anim_pos_acc]["count"])

      tex_uv_acc = tex_attrs.get("TEXCOORD_0")
      if not isinstance(tex_uv_acc, int):
        raise ValueError("single-mesh: tex TEXCOORD_0 accessor missing")
      tex_uv = tex_accessors[tex_uv_acc]
      tex_uv_count = int(tex_uv["count"])
      if tex_uv_count != anim_vertex_count:
        raise ValueError(
          f"single-mesh: TEXCOORD_0 vertex count mismatch anim={anim_vertex_count} tex={tex_uv_count}"
        )

      uv_bytes = _extract_accessor_bytes(tex, tex_glb.bin, tex_uv_acc)
      new_bv_index = append_buffer_view(uv_bytes, target=34962)

      new_acc = {
        "bufferView": new_bv_index,
        "componentType": int(tex_uv["componentType"]),
        "count": tex_uv_count,
        "type": str(tex_uv["type"]),
      }
      if "normalized" in tex_uv:
        new_acc["normalized"] = bool(tex_uv["normalized"])

      anim_accessors.append(new_acc)
      anim_attrs["TEXCOORD_0"] = len(anim_accessors) - 1
      print(
        f"single-mesh: copied TEXCOORD_0 from tex to anim for prim {prim_index}",
        file=sys.stderr,
      )

  new_images: list[dict] = []
  for img in tex_images:
    img2 = dict(img)
    if "bufferView" in img2:
      img2["bufferView"] = copy_image_buffer_view(int(img2["bufferView"]))
    new_images.append(img2)

  anim["bufferViews"] = anim_buffer_views + new_buffer_views
  anim["images"] = new_images
  anim["samplers"] = tex_samplers
  anim["textures"] = tex_textures
  anim["materials"] = tex_materials

  anim["buffers"][0]["byteLength"] = len(_pad4(bytes(combined_bin), 0x00))

  ex_used = set(anim.get("extensionsUsed", [])) | set(tex.get("extensionsUsed", []))
  if ex_used:
    anim["extensionsUsed"] = sorted(ex_used)

  ex_req = set(anim.get("extensionsRequired", [])) | set(tex.get("extensionsRequired", []))
  if ex_req:
    anim["extensionsRequired"] = sorted(ex_req)

  return Glb(json=anim, bin=bytes(combined_bin))


def main(argv: list[str]) -> int:
  if len(argv) != 4:
    raise SystemExit("usage: merge_textures.py anim.glb tex.glb out.glb")

  anim_path = Path(argv[1])
  tex_path = Path(argv[2])
  out_path = Path(argv[3])

  anim_glb = read_glb(anim_path)
  tex_glb = read_glb(tex_path)
  out_glb = merge_textures(anim_glb, tex_glb)
  write_glb(out_path, out_glb)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv))
