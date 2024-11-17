@extends('layouts.app')

@section('content')
    <div class="container">
        <h1 class="my-4 text-center">Сброс пароля</h1>

        @if (session('status'))
            <div class="alert alert-success" role="alert">
                {{ session('status') }}
            </div>
        @endif

        @if ($errors->any())
            <div class="alert alert-danger" role="alert">
                <ul class="mb-0">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif


        <div class="row justify-content-center">
            <div class="col-md-6">
                <form action="{{ route('password.update') }}" method="POST">
                    @csrf

                    <!-- Скрытое поле для токена -->
                    <input type="hidden" name="token" value="{{ $token }}">

                    <!-- Поле для email -->
                    <div class="mb-3">
                        <label for="email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="email" name="email" placeholder="Введите ваш email" value="{{ old('email') }}" required autofocus>
                    </div>

                    <!-- Поле для нового пароля -->
                    <div class="mb-3">
                        <label for="password" class="form-label">Новый пароль</label>
                        <input type="password" class="form-control" id="password" name="password" placeholder="Введите новый пароль" required>
                    </div>

                    <!-- Поле для подтверждения пароля -->
                    <div class="mb-3">
                        <label for="password_confirmation" class="form-label">Подтвердите пароль</label>
                        <input type="password" class="form-control" id="password_confirmation" name="password_confirmation" placeholder="Повторите новый пароль" required>
                    </div>

                    <!-- Кнопка отправки -->
                    <div class="d-grid">
                        <button type="submit" class="btn btn-primary">Сбросить пароль</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection
