import Image from "next/image";

type BrandLogoProps = {
  alt?: string;
  className?: string;
};

export function BrandLogo({ alt = "Ziddu", className }: BrandLogoProps) {
  return <Image alt={alt} className={className ? `brand-image ${className}` : "brand-image"} height={482} loading="eager" src="/ziddu-logo.png" width={1280} />;
}
