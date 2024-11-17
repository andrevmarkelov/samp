<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>SAMP Role Play</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>

    {{-- Header --}}
    @include('inc.header')

    {{-- Content --}}
    <div id="content">@yield('content')</div>

    {{-- Footer --}}
    @include('inc.footer')

    {{-- Modals --}}
    @include('modals.login')
    @include('modals.forgot-password')

    @vite(['resources/js/requests.js'])
</body>
</html>
