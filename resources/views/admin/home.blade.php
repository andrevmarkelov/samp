@extends('layouts.admin')

@section('content')
    <div class="row d-flex justify-content-center align-items-center mb-5">
        <div class="col-md-8">
            <h1 class="h5 text-center mb-3">Статистика за последние 30 дней:</h1>
            <canvas id="chart">Ваш браузер не поддерживает элемент canvas.</canvas>
        </div>
    </div>

    <div class="row">
        <h1 class="h5 text-center mb-3">Общая статистика на {{ date('d.m.Y') }}</h1>

        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-people-fill h3"></i>
                <strong>Всего пользователей</strong>
                <p>{{ $users }}</p>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-house-door-fill h3"></i>
                <strong>Всего домов</strong>
                <p>{{ $houses }}</p>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-briefcase-fill h3"></i>
                <strong>Всего бизнесов</strong>
                <p>{{ $businesses }}</p>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-wallet-fill h3"></i>
                <strong>Прибыль</strong>
                <p>40243</p>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script src="{{ asset('assets/libs/chart/js/chart.js') }}"></script>
    <script>
        const chartElement = document.getElementById('chart');
        new Chart(chartElement, {
            type: 'line',
            data: {
                labels: [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 31, 30, 29, 28, 27],
                datasets: [
                    {
                        label: 'Регистрация пользователей',
                        data: [18, 11, 15, 20, 9, 12, 18, 10, 1, 9, 1, 11, 4, 1, 12, 3, 4, 11, 12, 14, 5, 4, 20, 20, 1, 12, 14, 5, 15, 4],
                        borderWidth: 1,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                    },
                    {
                        label: 'Прибыль',
                        data: [5, 11, 6, 9, 9, 12, 0, 10, 1, 9, 1, 5, 4, 1, 12, 3, 4, 11, 12, 14, 5, 4, 1, 8, 1, 12, 9, 2, 6, 4],
                        borderWidth: 1,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1,
                    }
                ]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    </script>
@endpush
