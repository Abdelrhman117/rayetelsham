import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Removed — invoices are now generated client-side" }, { status: 410 });
}
