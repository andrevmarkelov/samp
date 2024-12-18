<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">

    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="robots" content="noindex">

    <title>Администрирование - {{ $serverName }}</title>

    <link rel="icon" type="image/png" href="{{ asset('favicon.png') }}">

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    <link rel="stylesheet" href="{{ asset('assets/libs/quill/css/quill.css') }}">
</head>
<body class="bg-body-secondary">

    <div class="d-flex">
        {{-- Меню --}}
        @include('admin.inc.menu')

        {{-- Контент --}}
        <div id="content" class="bg-body-tertiary m-5 p-5 w-100 shadow-sm rounded">
            @yield('content')
        </div>
    </div>

    {{-- Scripts --}}
    <script src="{{ asset('assets/libs/quill/js/quill.js')}}"></script>
    @stack('scripts')
</body>
</html>
