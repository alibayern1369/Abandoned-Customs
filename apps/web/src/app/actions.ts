'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  changePasswordForUser,
  loginWithPassword,
  logoutSession,
  requireSessionUser,
} from '@/lib/auth';
import { resolveReviewItem } from '@/lib/queries/reviews';

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'نام کاربری و رمز عبور الزامی است.' };
  }

  const result = await loginWithPassword(username, password);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await logoutSession();
  redirect('/login');
}

export async function changePasswordAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireSessionUser();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (newPassword !== confirmPassword) {
    return { error: 'تکرار رمز جدید مطابقت ندارد.' };
  }

  const result = await changePasswordForUser({
    userId: user.id,
    currentPassword,
    newPassword,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: 'رمز عبور با موفقیت تغییر کرد.' };
}

export async function resolveReviewAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  const id = String(formData.get('id') ?? '');
  const note = String(formData.get('note') ?? '');
  if (!id) return;
  await resolveReviewItem({ id, userId: user.id, note, status: 'RESOLVED' });
  revalidatePath('/reviews');
  revalidatePath('/');
  revalidatePath('/kootajs');
}

export async function ignoreReviewAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  const id = String(formData.get('id') ?? '');
  const note = String(formData.get('note') ?? '');
  if (!id) return;
  await resolveReviewItem({ id, userId: user.id, note, status: 'IGNORED' });
  revalidatePath('/reviews');
  revalidatePath('/');
  revalidatePath('/kootajs');
}
