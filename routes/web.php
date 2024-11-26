<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ForgotPasswordController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ResetPasswordController;
use App\Http\Controllers\ShopController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::get('shop', [ShopController::class, 'index'])->name('shop');
Route::post('shop', [ShopController::class, 'processPayment'])->name('payment');

Route::get('news', [NewsController::class, 'index'])->name('news');
Route::get('news/{slug}', [NewsController::class, 'show'])->name('news.show');

Route::group(['prefix' => 'auth'], function () {
    Route::post('login', [AuthController::class, 'login'])->name('login');
    Route::post('forgot-password', ForgotPasswordController::class)->name('password.email');
    Route::get('reset-password', [ResetPasswordController::class, 'reset'])->name('password.reset');
    Route::post('reset-password', [ResetPasswordController::class, 'update'])->name('password.update');
});

Route::group(['prefix' => 'profile', 'middleware' => ['auth.user']], function () {
    Route::get('/', [ProfileController::class, 'index'])->name('profile.index');

    Route::get('map', [MapController::class, 'index'])->name('profile.map');

    Route::get('settings', [ProfileController::class, 'settings'])->name('profile.settings');
    Route::post('settings', [ProfileController::class, 'changePassword'])->name('profile.settings.password');

    Route::get('payment-history', [ProfileController::class, 'paymentHistory'])->name('profile.payment.history');

    Route::post('logout', [AuthController::class, 'logout'])->name('profile.logout');
});

Route::group(['prefix' => 'company'], function () {
    Route::get('about', [PageController::class, 'about'])->name('company.about');
    Route::get('user-agreement', [PageController::class, 'userAgreement'])->name('user.agreement');
    Route::get('privacy-policy', [PageController::class, 'privacyPolicy'])->name('privacy.policy');
});

require_once __DIR__ . '/admin.php';
