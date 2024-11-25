<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

class UserController extends Controller
{
    /**
     * Отображает список всех пользователей.
     *
     * @return View
     */
    public function index(): View
    {
        $users = User::select(['id', 'username', 'p_level', 'email', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return view('admin.users.index', [
            'users' => $users
        ]);
    }

    /**
     * Отображаем форму редактирования для указанного пользователя.
     *
     * @param User $user
     * @return View
     */
    public function editForm(User $user): View
    {
        $user = User::findOrFail($user->id);

        return view('admin.users.edit', [
            'user' => $user
        ]);
    }

    /**
     * Обновляет данные указанного пользователя.
     *
     * @param UpdateUserRequest $request
     * @param User $user
     * @return RedirectResponse
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $validated = $request->validated();

        if (!empty($validated['password'])) {
            $validated['password'] = md5($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return redirect()->route('admin.users.edit.form', $user->id)->with('success', 'Пользователь успешно обновлен.');
    }

    /**
     * Удаляем указанного пользователя.
     *
     * @param User $user
     * @return RedirectResponse
     */
    public function destroy(User $user): RedirectResponse
    {
        $user->delete();

        return redirect()->route('admin.users')->with('success', 'Пользователь успешно удален.');
    }

    /**
     * Отображает список платежей пользователя с их статусами и общей суммой успешных платежей.
     *
     * Метод получает данные всех платежей указанного пользователя, отсортированных по дате создания (от новых к старым),
     * и передает их в представление для отображения. Также вычисляет общую сумму всех платежей пользователя
     * со статусом "успешный" (Success) для показа на странице.
     *
     * @param User $user Пользователь, чьи платежи необходимо отобразить.
     * @return View Возвращает представление с данными о платежах и общей суммой успешных платежей.
     */
    public function payments(User $user): View
    {
        $payments = $user
            ->payments()
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        $successfulPaymentsTotal = $user->payments()
            ->where('status', PaymentStatus::Success->value)
            ->sum('amount');

        return view('admin.users.payments', [
            'user' => $user,
            'payments' => $payments,
            'successfulPaymentsTotal' => $successfulPaymentsTotal
        ]);
    }
}
