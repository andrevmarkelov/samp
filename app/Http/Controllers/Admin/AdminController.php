<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminAuthRequest;
use App\Http\Requests\StoreAdminRequest;
use App\Http\Requests\UpdateAdminRequest;
use App\Models\Admin;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    /**
     * Форма авторизации в админку.
     *
     * @return View
     */
    public function index(): View
    {
        return view('admin.auth');
    }

    /**
     * Авторизация в админку.
     *
     * @param AdminAuthRequest $request
     * @return RedirectResponse
     */
    public function login(AdminAuthRequest $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => 'required|string',
            'password' => 'required|string',
        ]);

        if (Auth::guard('admin')->attempt($credentials)) {
            $request->session()->regenerate();
            return redirect()->route('admin.index');
        }

        return back()->withErrors('Неверный логин или пароль');
    }

    /**
     * Отображение списка администраторов.
     *
     * @return View
     */
    public function adminList(): View
    {
        $admins = Admin::paginate(10);

        return view('admin.admins.index', [
            'admins' => $admins
        ]);
    }

    /**
     * Форма редактирования администратора.
     *
     * @param Admin $admin
     * @return View
     */
    public function editForm(Admin $admin): View
    {
        return view('admin.admins.edit', [
            'admin' => $admin,
        ]);
    }

    /**
     * Обновление данных администратора.
     *
     * @param UpdateAdminRequest $request
     * @param Admin $admin
     * @return RedirectResponse
     */
    public function update(UpdateAdminRequest $request, Admin $admin): RedirectResponse
    {
        $data = $request->validated();

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->input('password'));
        } else {
            unset($data['password']);
        }

        $admin->update($data);

        return redirect()
            ->route('admin.admins.edit.form', $admin)
            ->with('success', 'Данные администратора успешно обновлены.');
    }

    /**
     * Форма создания нового администратора.
     *
     * @return View
     */
    public function createForm(): View
    {
        return view('admin.admins.create');
    }

    /**
     * Сохранение нового администратора.
     *
     * @param StoreAdminRequest $request
     * @return RedirectResponse
     */
    public function store(StoreAdminRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        Admin::create($data);

        return redirect()
            ->route('admin.admins.index')
            ->with('success', 'Администратор успешно создан.');
    }

    /**
     * Удаление администратора.
     *
     * @param Admin $admin
     * @return RedirectResponse
     */
    public function destroy(Admin $admin): RedirectResponse
    {
        if ($admin->name === env('SUPER_ADMIN_NAME', 'Super_Admin')) {
            return back()->with('success', 'Нельзя удалить супер-администратора.');
        }

        $admin->delete();
        return redirect()->route('admin.admins.index')->with('success', 'Администратор удален.');
    }


    /**
     * Личный кабинет администратора.
     *
     * @return View
     */
    public function profile(): View
    {
        $admin = auth('admin')->user();

        return view('admin.profile', [
            'admin' => $admin
        ]);
    }

    /**
     * Выход админа из системы
     *
     * @return RedirectResponse
     */
    public function logout(): RedirectResponse
    {
        Auth::guard('admin')->logout();
        return redirect()->route('home');
    }
}
