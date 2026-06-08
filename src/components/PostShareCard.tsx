import Image from "next/image";

interface PostShareCardProps {
  imageUrl: string;
  alt: string;
  width: number;
  height: number;
}

export default function PostShareCard({ imageUrl, alt, width, height }: PostShareCardProps) {
  return (
    <figure className="mb-12 overflow-hidden rounded-[4px] border border-nothing-border bg-[#f4eee8]">
      <Image
        src={imageUrl}
        alt={alt}
        width={width}
        height={height}
        className="block aspect-[1200/630] h-auto w-full"
        priority
        unoptimized
      />
    </figure>
  );
}
