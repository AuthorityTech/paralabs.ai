import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { paths?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { paths } = body;
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: "paths array required" },
      { status: 400 },
    );
  }

  const results: { path: string; revalidated: boolean }[] = [];
  for (const path of paths) {
    if (typeof path !== "string" || !path.startsWith("/")) continue;
    revalidatePath(path);
    results.push({ path, revalidated: true });
  }

  return NextResponse.json({ ok: true, results });
}

