import { useState } from "react";
import { PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <img src={failedSource === src ? PRODUCT_PLACEHOLDER : src} alt={alt} onError={() => setFailedSource(src)} />;
}
