<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ForgotPasswordController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ResetPasswordController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::group(['prefix' => 'auth'], function () {
    Route::post('login', [AuthController::class, 'login'])->name('login');
    Route::post('forgot-password', ForgotPasswordController::class)->name('password.email');
    Route::get('reset-password', [ResetPasswordController::class, 'reset'])->name('password.reset');
    Route::post('reset-password', [ResetPasswordController::class, 'update'])->name('password.update');
});

Route::group(['prefix' => 'profile', 'middleware' => ['auth.user']], function () {
    Route::get('/', [ProfileController::class, 'index'])->name('profile.index');
    Route::get('settings', [ProfileController::class, 'settings'])->name('profile.settings');
    Route::post('settings', [ProfileController::class, 'changePassword'])->name('profile.settings.password');
    Route::post('logout', [AuthController::class, 'logout'])->name('profile.logout');
});
