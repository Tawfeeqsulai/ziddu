import Image from "next/image";

type BrandLogoProps = {
  alt?: string;
};

export function BrandLogo({ alt = "Ziddu" }: BrandLogoProps) {
  return <Image alt={alt} className="brand-image" height={482} src="/ziddu-logo.png" width={1280} />;
}
