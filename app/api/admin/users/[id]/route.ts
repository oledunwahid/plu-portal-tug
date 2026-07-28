import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, findUserByEmailExcluding, updateUser, deleteUser } from '@/lib/db';
import { updateUserSchema } from '@/lib/validations';
import { WINE_PIC_ACCOUNT_TYPE, WINE_PIC_BUSINESS_UNIT } from '@/lib/winePermissions';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const user = await getUserById(params.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error('[GET /api/admin/users/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    if (params.id === session.user.id && parsed.data.role === 'CASHIER') {
      return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 });
    }
    if (params.id === session.user.id && parsed.data.active === false) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
    }

    if (parsed.data.email) {
      const collision = await findUserByEmailExcluding(parsed.data.email, params.id);
      if (collision) return NextResponse.json({ error: 'Email already in use by another user.' }, { status: 409 });
    }

    const data: Parameters<typeof updateUser>[1] = { ...parsed.data };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    // Promoting an account to Wine PIC also gives it the Wine Cork business unit (the branding label);
    // demoting it clears the label so the account falls back to "[ROLE] · [OUTLET]".
    if ('accountType' in parsed.data) {
      if (parsed.data.accountType === WINE_PIC_ACCOUNT_TYPE) {
        data.businessUnit = parsed.data.businessUnit ?? WINE_PIC_BUSINESS_UNIT;
      } else if (parsed.data.accountType === null && parsed.data.businessUnit === undefined) {
        data.businessUnit = null;
      }
    }

    const user = await updateUser(params.id, data);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error('[PATCH /api/admin/users/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (params.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const deleted = await deleteUser(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/users/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
