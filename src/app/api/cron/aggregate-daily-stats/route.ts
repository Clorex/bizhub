import { NextRequest, NextResponse } from 'next/server';
import { AggregatorService } from '@/services/analytics/aggregator.service';

/**
 * POST /api/cron/aggregate-daily-stats
 * 
 * Cron endpoint to pre-compute daily stats.
 * Should be called once daily (e.g., via Vercel Cron, external scheduler).
 * 
 * Protected by CRON_SECRET environment variable.
 * 
 * Query params:
 *   ?date=YYYY-MM-DD  (optional, defaults to yesterday)
 *   ?backfill=true&vendor_id=xxx&days=60  (optional backfill mode)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Invalid CRON_SECRET.',
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const backfill = url.searchParams.get('backfill');
    const vendorId = url.searchParams.get('vendor_id');
    const days = url.searchParams.get('days');
    const dateParam = url.searchParams.get('date');

    // ===========================
    // BACKFILL MODE
    // ===========================
    if (backfill === 'true' && vendorId && days) {
      const daysNum = parseInt(days, 10);

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return NextResponse.json(
          {
            success: false,
            error: 'Days must be between 1 and 365',
          },
          { status: 400 }
        );
      }

      console.log(`📊 Backfilling ${daysNum} days for vendor ${vendorId}`);

      const result = await AggregatorService.backfill(vendorId, daysNum);

      return NextResponse.json(
        {
          success: true,
          data: {
            mode: 'backfill',
            vendor_id: vendorId,
            days_processed: result.daysProcessed,
            errors: result.errors,
          },
          error: null,
        },
        { status: 200 }
      );
    }

    // ===========================
    // SPECIFIC DATE MODE
    // ===========================
    if (dateParam) {
      const date = new Date(dateParam);

      if (isNaN(date.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid date format. Use YYYY-MM-DD.',
          },
          { status: 400 }
        );
      }

      console.log(`📊 Aggregating stats for ${dateParam}`);

      const result = await AggregatorService.aggregateAllVendors(date);

      return NextResponse.json(
        {
          success: true,
          data: {
            mode: 'specific_date',
            date: dateParam,
            vendors_processed: result.vendorsProcessed,
            errors: result.errors,
          },
          error: null,
        },
        { status: 200 }
      );
    }

    // ===========================
    // DEFAULT: YESTERDAY
    // ===========================
    console.log('📊 Running daily aggregation (yesterday)');

    const result = await AggregatorService.aggregateYesterday();

    return NextResponse.json(
      {
        success: true,
        data: {
          mode: 'yesterday',
          vendors_processed: result.vendorsProcessed,
          errors: result.errors,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cron aggregation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Aggregation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check / manual trigger info.
 */
export async function GET() {
  return NextResponse.json(
    {
      endpoint: '/api/cron/aggregate-daily-stats',
      method: 'POST',
      description: 'Daily stats aggregation cron endpoint',
      params: {
        default: 'Aggregates yesterday for all vendors',
        date: '?date=YYYY-MM-DD - Aggregate specific date',
        backfill: '?backfill=true&vendor_id=xxx&days=60 - Backfill mode',
      },
      auth: 'Bearer CRON_SECRET header required',
    },
    { status: 200 }
  );
}