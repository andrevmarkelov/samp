<?php

namespace Database\Seeders;

use App\Models\Business;
use Illuminate\Database\Seeder;

class BusinessSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $businesses = $this->businesses();

        foreach ($businesses as $data) {
            Business::create($data);
        }
    }

    /**
     * Список бизнесов
     *
     * @return array[]
     */
    private function businesses(): array
    {
        return [
            ['name' => 'Alhambra', 'entrance_x' => 1836.51, 'entrance_y' => -1682.58, 'entrance_z' => 13.345, 'price' => 100000],
            ['name' => 'PigPen', 'entrance_x' => 2421.59, 'entrance_y' => -1219.51, 'entrance_z' => 25.5444, 'price' => 100000],
            ['name' => 'Misty Club', 'entrance_x' => -2242.2, 'entrance_y' => -88.0869, 'entrance_z' => 35.3203, 'price' => 100000],
            ['name' => 'Casino Bellagio', 'entrance_x' => 1658.5, 'entrance_y' => 2250.05, 'entrance_z' => 11.07, 'price' => 100000],
            ['name' => 'Grove Street Bar', 'entrance_x' => 2309.95, 'entrance_y' => -1643.42, 'entrance_z' => 14.8269, 'price' => 80000],
            ['name' => 'Sobrino de Botin', 'entrance_x' => 2269.86, 'entrance_y' => -74.1605, 'entrance_z' => 26.7723, 'price' => 100000],
            ['name' => 'Vinewood Burger', 'entrance_x' => 1199.18, 'entrance_y' => -918.168, 'entrance_z' => 43.1236, 'price' => 100000],
            ['name' => 'Marina Burger', 'entrance_x' => 810.492, 'entrance_y' => -1616.15, 'entrance_z' => 13.5468, 'price' => 100000],
            ['name' => 'Idlewood Pizza', 'entrance_x' => 2105.48, 'entrance_y' => -1806.37, 'entrance_z' => 13.5546, 'price' => 100000],
            ['name' => 'Downtown Cluc', 'entrance_x' => -1816.64, 'entrance_y' => 618.672, 'entrance_z' => 35.1719, 'price' => 100000],
            ['name' => 'Marina Cluc', 'entrance_x' => 928.914, 'entrance_y' => -1352.79, 'entrance_z' => 13.3437, 'price' => 250000],
            ['name' => 'Idelwood 24/7', 'entrance_x' => 1928.6, 'entrance_y' => -1776.17, 'entrance_z' => 13.5468, 'price' => 100000],
            ['name' => 'Flint 24/7', 'entrance_x' => -78.436, 'entrance_y' => -1170.03, 'entrance_z' => 2.1354, 'price' => 100000],
            ['name' => 'Easter 24/7', 'entrance_x' => -1676.18, 'entrance_y' => 432.187, 'entrance_z' => 7.1796, 'price' => 100000],
            ['name' => 'Mullholand 24/7', 'entrance_x' => 1000.59, 'entrance_y' => -919.911, 'entrance_z' => 42.328, 'price' => 100000],
            ['name' => 'Jizzy', 'entrance_x' => -2624.49, 'entrance_y' => 1411.88, 'entrance_z' => 7.0938, 'price' => 100000],
            ['name' => 'Redsands West 24/7', 'entrance_x' => 1599.12, 'entrance_y' => 2221.87, 'entrance_z' => 11.0625, 'price' => 100000],
            ['name' => 'Julious 24/7', 'entrance_x' => 2637.29, 'entrance_y' => 1129.68, 'entrance_z' => 11.1796, 'price' => 100000],
            ['name' => 'Lil"Probe"inn', 'entrance_x' => -89.6103, 'entrance_y' => 1378.24, 'entrance_z' => 10.4697, 'price' => 100000],
            ['name' => 'Idelwood Gas', 'entrance_x' => 1940.93, 'entrance_y' => -1772.94, 'entrance_z' => 13.6406, 'price' => 100000],
            ['name' => 'Mullholand Gas', 'entrance_x' => 1003.76, 'entrance_y' => -936.11, 'entrance_z' => 42.3281, 'price' => 300000],
            ['name' => 'Whetstone 24-7', 'entrance_x' => -1567.11, 'entrance_y' => -2730.04, 'entrance_z' => 48.7435, 'price' => 100000],
            ['name' => 'East Cluc', 'entrance_x' => 2419.85, 'entrance_y' => -1508.87, 'entrance_z' => 24, 'price' => 100000],
            ['name' => 'WillowField Cluc', 'entrance_x' => 2397.94, 'entrance_y' => -1899.2, 'entrance_z' => 13.5469, 'price' => 100000],
            ['name' => 'Flats Cluc', 'entrance_x' => -2672.29, 'entrance_y' => 258.429, 'entrance_z' => 4.63281, 'price' => 100000],
            ['name' => 'Financial Pizza', 'entrance_x' => -1808.78, 'entrance_y' => 945.849, 'entrance_z' => 24.8906, 'price' => 100000],
            ['name' => 'Come-A-Lot Gas', 'entrance_x' => 2115.31, 'entrance_y' => 919.956, 'entrance_z' => 10.8203, 'price' => 450000],
            ['name' => 'FortCarson Gas', 'entrance_x' => 70.6284, 'entrance_y' => 1218.96, 'entrance_z' => 18.8125, 'price' => 100000],
            ['name' => 'BoneCountry Gas', 'entrance_x' => 611.912, 'entrance_y' => 1694.78, 'entrance_z' => 6.99219, 'price' => 100000],
            ['name' => 'Julius Gas', 'entrance_x' => 2640.31, 'entrance_y' => 1106.13, 'entrance_z' => 10.8203, 'price' => 100000],
            ['name' => 'PricklePine Gas', 'entrance_x' => 2146.86, 'entrance_y' => 2748.08, 'entrance_z' => 10.8203, 'price' => 100000],
            ['name' => 'Flint Gas', 'entrance_x' => -91.0336, 'entrance_y' => -1168.99, 'entrance_z' => 2.4236, 'price' => 100000],
            ['name' => 'Easter Gas', 'entrance_x' => -1675.54, 'entrance_y' => 413.452, 'entrance_z' => 7.17969, 'price' => 100000],
            ['name' => 'Doherty Gas', 'entrance_x' => -2026.7, 'entrance_y' => 156.561, 'entrance_z' => 29.0391, 'price' => 400000],
            ['name' => 'Juniper 24/7', 'entrance_x' => -2420.16, 'entrance_y' => 969.801, 'entrance_z' => 45.2969, 'price' => 100000],
            ['name' => 'Juniper Gas', 'entrance_x' => -2410.85, 'entrance_y' => 973.991, 'entrance_z' => 45.4609, 'price' => 120000],
            ['name' => 'Emerald Isle 24/7', 'entrance_x' => 2187.71, 'entrance_y' => 2469.6, 'entrance_z' => 11.2422, 'price' => 100000],
            ['name' => 'Emerald Isle Gas', 'entrance_x' => 2202.19, 'entrance_y' => 2474.56, 'entrance_z' => 10.8203, 'price' => 100000],
            ['name' => 'Redsands-West Gas', 'entrance_x' => 1596.15, 'entrance_y' => 2198.81, 'entrance_z' => 10.8203, 'price' => 320000],
            ['name' => 'ElGuebrabos Gas', 'entrance_x' => -1328.47, 'entrance_y' => 2677.47, 'entrance_z' => 50.0625, 'price' => 100000],
            ['name' => 'TierraRobada Gas', 'entrance_x' => -1471.27, 'entrance_y' => 1863.98, 'entrance_z' => 32.6328, 'price' => 100000],
            ['name' => 'AngelPine Gas', 'entrance_x' => -2243.93, 'entrance_y' => -2560.73, 'entrance_z' => 31.9219, 'price' => 100000],
            ['name' => 'Whestone Gas', 'entrance_x' => -1605.93, 'entrance_y' => -2714.13, 'entrance_z' => 48.5335, 'price' => 100000],
            ['name' => 'Dilimore Gas', 'entrance_x' => 655.629, 'entrance_y' => -565.151, 'entrance_z' => 16.3359, 'price' => 300000],
            ['name' => 'Montgomery Gas', 'entrance_x' => 1382.44, 'entrance_y' => 460.336, 'entrance_z' => 20.0579, 'price' => 100000],
        ];
    }
}
