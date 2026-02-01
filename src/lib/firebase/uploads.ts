import { storage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadProductImages(params: {
  businessId: string;
  productId: string;
  files: File[];
}) {
  const { businessId, productId, files } = params;

  const urls: string[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `businesses/${businessId}/products/${productId}/${Date.now()}_${safeName}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    urls.push(url);
  }

  return urls;
}