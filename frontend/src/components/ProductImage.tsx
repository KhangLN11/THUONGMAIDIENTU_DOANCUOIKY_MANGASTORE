import { useState } from "react";
import "./true-color-gallery.css";
import { PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";

export function ProductImage({
  src,
  alt,
  variant = "editorial",
}: {
  src: string;
  alt: string;
  variant?: "editorial" | "trueColor";
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <img
      data-product-color={variant === "trueColor" ? "trueColor" : undefined}
      src={!src || failedSource === src ? PRODUCT_PLACEHOLDER : src}
      alt={alt}
      onError={() => setFailedSource(src)}
    />
  );
}
