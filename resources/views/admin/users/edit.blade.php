@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4 mb-4">
            <h1 class="h3">{{ $user->username }}</h1>
            <a href="{{ route('admin.users.payments', $user->id) }}" class="btn btn-success">Платежи</a>
        </div>

        @if ($errors->any())
            <div class="alert alert-danger">
                <ul class="nav mb-0">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        @if(session('success'))
            <div class="alert alert-success">
                {{ session('success') }}
            </div>
        @endif

        <form action="{{ route('admin.users.edit', $user) }}" method="POST">
            @csrf
            @method('PUT')

            <div class="row d-flex align-items-center">
                <div class="col-md-2 mb-3">
                    <div class="d-flex flex-column align-items-center text-center card py-3">
                        <img src="{{ asset('assets/images/skins/' . $user->p_skin . '.png') }}" width="120" alt="{{ $user->username }}" class="mb-1">
                        <p class="fw-bold">{{ $user->username }}</p>
                        <div>
                            <div>Номер аккауна: {{ $user->id }}</div>
                            <div>Уровень: {{ $user->p_level }}</div>
                        </div>
                    </div>
                </div>

                <div class="col-md-10">
                    <div class="mb-3">
                        <label for="username" class="form-label">Никнейм</label>
                        <input type="text" name="username" id="username" class="form-control" value="{{ old('username', $user->username ?? '') }}" required>
                    </div>

                    <div class="mb-3">
                        <label for="email" class="form-label">Email</label>
                        <input type="email" name="email" id="email" class="form-control {{ is_null($user->email_verified_at) ? 'is-invalid' : '' }}"  value="{{ old('email', $user->email) }}" required>
                        @if (is_null($user->email_verified_at))
                            <div class="d-block invalid-feedback">У пользователя не подтверждена почта.</div>
                        @endif
                    </div>

                    <div class="mb-3">
                        <label for="created_at" class="form-label">Дата регистрации</label>
                        <input type="text" class="form-control" id="created_at" value="{{ $user->created_at ?? '' }}" readonly>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="p_level" class="form-label">Уровень</label>
                        <input type="number" name="p_level" id="p_level" class="form-control" value="{{ old('p_level', $user->p_level ?? '') }}" required>
                    </div>

                    <div class="mb-3">
                        <label for="p_money" class="form-label">Наличные деньги</label>
                        <input type="number" name="p_money" id="p_money" class="form-control" value="{{ old('p_money', $user->p_money ?? '') }}" required>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="p_donate" class="form-label">Донат счет</label>
                        <input type="number" name="p_donate" id="p_donate" class="form-control" value="{{ old('p_donate', $user->p_donate ?? '') }}" required>
                    </div>

                    <div class="mb-3">
                        <label for="p_skin" class="form-label">Скин</label>
                        <input type="number" name="p_skin" id="p_skin" class="form-control" value="{{ old('p_skin', $user->p_skin ?? '') }}" required>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="password" class="form-label">Пароль</label>
                        <input type="password" name="password" id="password" class="form-control">
                        <small class="form-text text-muted">Оставьте поле пустым, если не хотите менять пароль</small>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="password_confirmation" class="form-label">Подтверждение пароля</label>
                        <input type="password" name="password_confirmation" id="password_confirmation" class="form-control">
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center">
                <a href="{{ route('admin.users') }}" class="btn btn-secondary">Назад</a>
                <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
        </form>
    </div>
@endsection
