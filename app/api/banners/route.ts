import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const banners = await prisma.homeBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(banners);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { bannerImg, title, description, btnText, btnLink, mode, status } = body;
    if (!bannerImg || !title || !description || !btnText) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    // Append new banners to the end of their mode group.
    const bannerMode = mode || "both";
    const max = await prisma.homeBanner.aggregate({
      where: { mode: bannerMode },
      _max: { sortOrder: true },
    });
    const banner = await prisma.homeBanner.create({
      data: {
        bannerImg, title, description, btnText,
        btnLink: btnLink || null,
        mode: bannerMode,
        status: status ?? true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(banner, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}