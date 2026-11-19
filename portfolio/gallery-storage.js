import { galleryBucket, uploadPath } from './gallery-document.js';

export const photoLinkLifetime = 600;

export async function signGalleryPhotos(post, storageUrl, ids) {
  const files = new Map(ids.map(id => [uploadPath(id), id]).filter(([path]) => path));
  if (!files.size) return new Map();

  const result = await post(`/storage/v1/object/sign/${galleryBucket}`, {
    paths: [...files.keys()],
    expiresIn: photoLinkLifetime,
  });

  const urls = new Map();
  for (const { path, signedURL } of result) {
    if (files.has(path) && signedURL?.startsWith(`/object/sign/${galleryBucket}/${path}?`)) {
      urls.set(files.get(path), storageUrl + signedURL);
    }
  }
  return urls;
}
