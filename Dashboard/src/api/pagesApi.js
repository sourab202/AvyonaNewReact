import { adminApi } from "./adminApi";

export function getPages(params = {}) {
  return adminApi.get("/admin/pages", { params });
}

export function getPage(id) {
  return adminApi.get(`/admin/pages/${encodeURIComponent(id)}`);
}

export function createPage(data) {
  return adminApi.post("/admin/pages", data);
}

export function updatePage(id, data) {
  return adminApi.put(`/admin/pages/${encodeURIComponent(id)}`, data);
}

export function deletePage(id) {
  return adminApi.delete(`/admin/pages/${encodeURIComponent(id)}`);
}

export function duplicatePage(id) {
  return adminApi.post(`/admin/pages/${encodeURIComponent(id)}/duplicate`);
}

export function updatePageStatus(id, status) {
  const payload = typeof status === "object" ? status : { status };
  return adminApi.patch(`/admin/pages/${encodeURIComponent(id)}/status`, payload);
}

export function uploadPageImage(file, onUploadProgress) {
  const formData = new FormData();
  formData.append("image", file);

  return adminApi.post("/admin/pages/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    onUploadProgress
  });
}

export function createBlock(pageId, data) {
  return adminApi.post(`/admin/pages/${encodeURIComponent(pageId)}/blocks`, data);
}

export function updateBlock(pageId, blockId, data) {
  return adminApi.put(
    `/admin/pages/${encodeURIComponent(pageId)}/blocks/${encodeURIComponent(blockId)}`,
    data
  );
}

export function deleteBlock(pageId, blockId) {
  return adminApi.delete(`/admin/pages/${encodeURIComponent(pageId)}/blocks/${encodeURIComponent(blockId)}`);
}

export function reorderBlocks(pageId, blocks) {
  return adminApi.patch(`/admin/pages/${encodeURIComponent(pageId)}/blocks/reorder`, { blocks });
}
