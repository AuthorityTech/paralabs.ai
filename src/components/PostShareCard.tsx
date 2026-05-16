import { formatPostShareDate, formatPostShareMainTags } from "@/lib/postShare";

interface PostShareCardProps {
  date: string;
  tags?: string[];
}

export default function PostShareCard({ date, tags }: PostShareCardProps) {
  const shareDate = formatPostShareDate(date);
  const shareTags = formatPostShareMainTags(tags);

  return (
    <div
      className="relative mb-12 aspect-[1200/630] w-full overflow-hidden rounded-[4px] border border-nothing-border bg-[#f4eee8] text-[#171717]"
      aria-label={`Para Labs research card: ${shareTags} · ${shareDate}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(223,94,24,0.13),transparent_28%),radial-gradient(circle_at_80%_78%,rgba(223,94,24,0.08),transparent_34%)]" />
      <div className="absolute left-[7%] right-[7%] top-[13%] h-px bg-gradient-to-r from-transparent via-[#d8d0c8] to-transparent" />
      <div className="absolute bottom-[16%] left-[7%] right-[7%] h-px bg-gradient-to-r from-transparent via-[#d8d0c8] to-transparent" />
      <div className="absolute -right-[8%] -top-[20%] h-[62%] w-[42%] rounded-full border border-[#d8d0c8]" />
      <div className="absolute -bottom-[28%] -left-[10%] h-[58%] w-[38%] rounded-full border border-[#e2d7cf]" />
      <div className="absolute inset-x-[9%] bottom-[20%] flex justify-between opacity-45">
        {Array.from({ length: 36 }).map((_, idx) => (
          <span key={idx} className={idx === 17 ? "h-2 w-px bg-[#df5e18]" : "h-2 w-px bg-[#bbb3ac]"} />
        ))}
      </div>
      <div className="absolute inset-y-[22%] left-[20%] right-[20%] flex flex-col items-center justify-center text-center">
        <p className="font-mono text-[clamp(0.46rem,0.7vw,0.58rem)] font-medium uppercase tracking-[0.18em] text-[#8c8580]">
          Para Labs Research
        </p>
        <div className="my-4 h-px w-10 bg-[#df5e18]" />
        <p className="max-w-full text-balance font-display text-[clamp(0.9rem,1.75vw,1.55rem)] font-medium leading-tight tracking-[-0.005em]">
          {shareTags}
        </p>
        <p className="mt-4 font-mono text-[clamp(0.48rem,0.72vw,0.62rem)] font-medium uppercase tracking-[0.08em] text-[#8c8580]">
          {shareDate}
        </p>
      </div>
    </div>
  );
}
