<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminAuthRequest;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;

class AdminController extends Controller
{
    /**
     * Форма авторизации в админку
     *
     * @return View
     */
    public function index(): View
    {
        return view('admin.auth');
    }

    /**
     * Авторизация в админку
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
