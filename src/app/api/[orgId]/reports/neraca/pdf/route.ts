import { NextRequest } from "next/server"
import { handleReportPdfRequest } from "../../[reportType]/pdf/route"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  return handleReportPdfRequest(req, orgId, "neraca")
}
