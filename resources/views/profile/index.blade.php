@extends('layouts.app')

@section('content')
    <div class="container">
        <h1>Личный кабинет, {{ $user->username }}!</h1>
    </div>
@endsection
