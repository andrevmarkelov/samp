@extends('layouts.app')

@section('content')
    <div class="container">
        <h1>Личный кабинет, {{ $user->username }}!</h1>
        <p>Уровень: {{ $user->p_level  }}</p>
        <p>Деньги: {{ $user->p_money  }}</p>
        <p>Донат счет: {{ $user->p_donate  }}</p>
        <p>Email: {{ $user->email  }}</p>
    </div>
@endsection
