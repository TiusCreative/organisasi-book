import { prisma } from "./prisma"

export interface OrganizationBrandingInput {
  name: string
  address?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  phone?: string | null
  email?: string | null
}

export function buildOrganizationAddressLines(org: OrganizationBrandingInput) {
  return [
    org.address,
    [org.city, org.province, org.postalCode].filter(Boolean).join(", "),
    [org.phone, org.email].filter(Boolean).join(" | ")
  ].filter((line): line is string => Boolean(line))
}

export async function getOrganizationBranding(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      phone: true,
      email: true
    }
  })

  if (!org) return null

  return {
    name: org.name,
    addressLines: buildOrganizationAddressLines(org)
  }
}
