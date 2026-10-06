// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordForm from './PasswordForm';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), updateUser: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
beforeEach(() => {
  vi.resetAllMocks();
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'reader-a' } } },
  });
  auth.updateUser.mockResolvedValue({ error: null });
});
afterEach(cleanup);
describe('contraseña de la cuenta', () => {
  it('valida la repetición y guarda con la contraseña actual, borrando los campos al terminar', async () => {
    const user = userEvent.setup(),
      onSaved = vi.fn();
    render(<PasswordForm ownerId="reader-a" onSaved={onSaved} />);
    await user.type(
      screen.getByLabelText('Contraseña actual'),
      'current-password',
    );
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-password');
    await user.type(
      screen.getByLabelText('Repetir nueva contraseña'),
      'wrong-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar nueva contraseña' }),
    );
    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
    expect(auth.updateUser).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Repetir nueva contraseña'));
    await user.type(
      screen.getByLabelText('Repetir nueva contraseña'),
      'new-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar nueva contraseña' }),
    );
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({
      password: 'new-password',
      current_password: 'current-password',
    });
    expect(
      (screen.getByLabelText('Nueva contraseña') as HTMLInputElement).value,
    ).toBe('');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('usa el enlace de recuperación sin exigir la contraseña olvidada y permite reintentar', async () => {
    const user = userEvent.setup();
    auth.updateUser.mockResolvedValueOnce({ error: { code: 'weak_password' } });
    render(<PasswordForm ownerId="reader-a" recovery onSaved={() => {}} />);
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull();
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-password');
    await user.type(
      screen.getByLabelText('Repetir nueva contraseña'),
      'new-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar nueva contraseña' }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'reglas de seguridad',
    );
    expect(
      (screen.getByLabelText('Nueva contraseña') as HTMLInputElement).value,
    ).toBe('new-password');
    await user.click(
      screen.getByRole('button', { name: 'Guardar nueva contraseña' }),
    );
    expect(auth.updateUser).toHaveBeenLastCalledWith({
      password: 'new-password',
    });
    expect((await screen.findByRole('status')).textContent).toContain(
      'actualizado',
    );
  });
  it('impide cambiar la contraseña si la cuenta ha cambiado antes del envío', async () => {
    const user = userEvent.setup();
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'reader-b' } } },
    });
    render(<PasswordForm ownerId="reader-a" recovery onSaved={() => {}} />);
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-password');
    await user.type(
      screen.getByLabelText('Repetir nueva contraseña'),
      'new-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar nueva contraseña' }),
    );
    await screen.findByRole('alert');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
