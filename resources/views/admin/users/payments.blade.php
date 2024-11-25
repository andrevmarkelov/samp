@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4 mb-4">
            <h1 class="h3">Платежи пользователя: {{ $user->username }}</h1>

            <p>Общая сумма успешных платежей: <strong>{{ $successfulPaymentsTotal }}</strong></p>
        </div>

        @if ($payments->count())
            <div class="table-responsive">
                <table class="table table-bordered table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Сумма</th>
                            <th>Статус</th>
                            <th>Дата</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($payments as $payment)
                            <tr>
                                <td>{{ $payment->id }}</td>
                                <td>{{ number_format($payment->amount, 2) }}</td>
                                <td>{{ $payment->status->description() }}</td>
                                <td>{{ $payment->created_at }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            {{ $payments->links('inc.pagination') }}

        @else
            <p class="text-center">У пользователя нет платежей.</p>
        @endif

        <a href="{{ route('admin.users.edit', $user) }}" class="btn btn-primary">Назад</a>
    </div>
@endsection
