import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { daysUntilDue } from "@/lib/rotation-policy";

// GET /api/keys/expiration-alerts - Returns keys due for rotation, soonest first
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get discovered keys with their platform information
    const discoveredKeys = await prisma.discoveredKey.findMany({
      where: {
        userId: userId,
        status: "active", // Only active keys
      },
      include: {
        platformRef: true
      },
      orderBy: [
        { severity: "desc" }, // Critical first
        { foundAt: "desc" }, // Most recent first (DiscoveredKey uses `foundAt`, not `createdAt`)
      ],
    });

    // If no keys found, return empty result (no more mock data!)
    if (discoveredKeys.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          keys: [],
          summary: {
            criticalCount: 0,
            totalNeedingAttention: 0,
          },
        },
      });
    }

    // Transform for display. We don't know a key's real age, the recommendation is
    // anchored to foundAt (when we discovered it) via the rotation policy. Advisory only.
    const expirationAlerts = discoveredKeys.map((key) => {
      // Days until rotation is recommended; negative = overdue. Field name kept for callers.
      const daysUntilExpiry = daysUntilDue(key.foundAt, key.severity);

      let message = "";
      if (daysUntilExpiry < 0) {
        message = `Rotation overdue by ${Math.abs(daysUntilExpiry)} day${daysUntilExpiry !== -1 ? "s" : ""}`;
      } else if (daysUntilExpiry === 0) {
        message = "Rotation due today";
      } else {
        message = `Rotate in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`;
      }

      return {
        id: key.id,
        platform: key.platformRef?.name || key.platform || "Unknown Platform",
        status: key.severity.toUpperCase() as
          | "CRITICAL"
          | "HIGH"
          | "MEDIUM"
          | "LOW",
        message,
        daysUntilExpiry,
        timestamp: key.foundAt, // DiscoveredKey records its creation time as `foundAt`
      };
    });

    // Sort by urgency (days until expiry ascending, then by status)
    expirationAlerts.sort((a, b) => {
      if (a.daysUntilExpiry !== b.daysUntilExpiry) {
        return a.daysUntilExpiry - b.daysUntilExpiry;
      }
      const statusOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    // Calculate summary stats
    const critical = expirationAlerts.filter(
      (key) => key.daysUntilExpiry <= 0 || key.status === "CRITICAL",
    ).length;

    const needingAttention = expirationAlerts.filter(
      (key) => key.daysUntilExpiry <= 30,
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        keys: expirationAlerts,
        summary: {
          criticalCount: critical,
          totalNeedingAttention: needingAttention,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching expiration alerts:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
