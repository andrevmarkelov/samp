@extends('layouts.app')

@section('content')
    <div class="container py-5 min-vh-100">
        <div class="row justify-content-center">
            <div class="col-md-5">
                <h1 class="h2 text-center color-dark-blue">Авторизация</h1>

                @if ($errors->any())
                    <div class="alert alert-danger">
                        <ul class="nav mb-0">
                            @foreach ($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                <form id="adminLoginForm" action="{{ route('admin.login') }}" method="POST">
                    @csrf
                    <div class="mb-3">
                        <label for="a_email" class="form-label">Логин</label>
                        <input type="email" class="form-control" id="a_email" name="email" placeholder="Введите логин" required>
                    </div>
                    <div class="mb-3">
                        <label for="a_password" class="form-label">Пароль</label>
                        <input type="password" class="form-control" id="a_password" name="password" placeholder="Введите пароль" minlength="8" required>
                    </div>
                    <button type="submit" class="btn-default">Войти</button>
                </form>
            </div>
        </div>
    </div>
@endsection
