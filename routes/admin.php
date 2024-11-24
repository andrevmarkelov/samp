<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\HomeController;
use App\Http\Controllers\Admin\NewsController;
use Illuminate\Support\Facades\Route;

Route::group(['prefix' => 'admin'], function () {
    Route::get('auth', [AdminController::class, 'index'])->name('admin.auth');
    Route::post('auth', [AdminController::class, 'login'])->name('admin.login');
});

Route::group(['prefix' => 'admin', 'middleware' => ['auth.admin']], function () {
    Route::get('/', [HomeController::class, 'index'])->name('admin.index');

    Route::get('news', [NewsController::class, 'index'])->name('admin.news');
    Route::get('news/create', [NewsController::class, 'createForm'])->name('admin.news.create.form');

    Route::post('logout', [AdminController::class, 'logout'])->name('admin.logout');
});
