<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\HomeController;
use App\Http\Controllers\Admin\NewsController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::group(['prefix' => 'admin'], function () {
    Route::get('auth', [AdminController::class, 'index'])->name('admin.auth');
    Route::post('auth', [AdminController::class, 'login'])->name('admin.login');
});

Route::group(['prefix' => 'admin', 'middleware' => ['auth.admin']], function () {
    Route::get('/', [HomeController::class, 'index'])->name('admin.index');

    Route::get('news', [NewsController::class, 'index'])->name('admin.news');
    Route::get('news/create', [NewsController::class, 'createForm'])->name('admin.news.create.form');
    Route::post('news/create', [NewsController::class, 'store'])->name('admin.news.create');
    Route::get('news/edit/{news}', [NewsController::class, 'editForm'])->name('admin.news.edit.form');
    Route::put('news/edit/{news}', [NewsController::class, 'update'])->name('admin.news.edit');
    Route::delete('news/edit/{news}', [NewsController::class, 'destroy'])->name('admin.news.destroy');

    Route::get('users', [UserController::class, 'index'])->name('admin.users');
    Route::get('users/edit/{user}', [UserController::class, 'editForm'])->name('admin.users.edit.form');
    Route::put('users/edit/{user}', [UserController::class, 'update'])->name('admin.users.edit');
    Route::delete('users/edit/{user}', [UserController::class, 'destroy'])->name('admin.users.destroy');
    Route::get('users/{user}/payments', [UserController::class, 'payments'])->name('admin.users.payments');

    Route::get('admins', [AdminController::class, 'adminList'])->name('admin.admins.index');
    Route::get('admins/edit/{admin}', [AdminController::class, 'editForm'])->name('admin.admins.edit.form');
    Route::put('admins/edit/{admin}', [AdminController::class, 'update'])->name('admin.admins.edit');
    Route::get('admins/create', [AdminController::class, 'createForm'])->name('admin.admins.create.form');
    Route::post('admins/create', [AdminController::class, 'store'])->name('admin.admins.create');
    Route::delete('admins/{admin}', [AdminController::class, 'destroy'])->name('admin.admins.destroy');
    Route::get('profile', [AdminController::class, 'profile'])->name('admin.profile');

    Route::post('logout', [AdminController::class, 'logout'])->name('admin.logout');
});
