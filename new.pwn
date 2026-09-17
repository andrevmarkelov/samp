/*
	FASHION DESIGNER: gangzone.ini (Tatiana Malishko);
	VKONTAKTE: VK.COM/BELOCHKA_BELOCHKA ;
	NOT TO REMOVE COPYRIGHT, THANKS;
*/
@___If_u_can_read_this_u_r_nerd();    // 10 different ways to crash DeAMX
@___If_u_can_read_this_u_r_nerd()    // and also a nice tag for exported functions table in the AMX file
{ // by Daniel_Cortez \\ pro-pawn.ru
    #emit    stack    0x7FFFFFFF    // wtf (1) (stack over... overf*ck!?)
    #emit    inc.s    cellmax    // wtf (2) (this one should probably make DeAMX allocate all available memory and lag forever)
    static const ___[][] = {"pro-pawn", ".ru"};    // pretty old anti-deamx trick
    #emit    retn
    #emit    load.s.pri    ___    // wtf (3) (opcode outside of function?)
    #emit    proc    // wtf (4) (if DeAMX hasn't crashed already, it would think it is a new function)
    #emit    proc    // wtf (5) (a function inside of another function!?)
    #emit    fill    cellmax    // wtf (6) (fill random memory block with 0xFFFFFFFF)
    #emit    proc
    #emit    stack    1    // wtf (7) (compiler usually allocates 4 bytes or 4*N for arrays of N elements)
    #emit    stor.alt    ___    // wtf (8) (...)
    #emit    strb.i    2    // wtf (9)
    #emit    switch    4
    #emit    retn    // wtf (10) (no "casetbl" opcodes before retn - invalid switch statement?)
L1:
    #emit    jump    L1    // avoid compiler crash from "#emit switch"
    #emit    zero    cellmin    // wtf (11) (nonexistent address)
}
#include <a_samp>
#include <a_mysql>
#include <dc_cmd>
#include <sscanf2>
#include <foreach>
#include <streamer>
#include <mxdate>
#include <zone>

#define MYSQL_HOST					"localhost"
#define MYSQL_USER 	      	 		"root"
#define MYSQL_BASE 	      	 		"advancebase"
#define MYSQL_PASS 	      	 		""

#if defined MAX_PLAYERS
#undef MAX_PLAYERS
	#define MAX_PLAYERS        		20
#else
	#define MAX_PLAYERS         	20
#endif
#if defined MAX_GANGZONE
#undef MAX_GANGZONE
	#define MAX_GANGZONE        	104
#else
	#define MAX_GANGZONE        	104
#endif

#define TIME_SPAWN_CAR              600

#define HOST_NAME               	"Advance GangWar 1 | Purple Server"
#define SERVER_NAME             	"Advance GangWar"
#define MODE_NAME               	"Advance GW Russian"
#define SITE_NAME               	"advance-gw.ru"
#define RCON_PASSWORD           	"1"

#define NAME_DEVELOPER_ONE          "gangzone"

#define DIALOGUE_INFORMATION    	0
#define DIALOGUE_AUTHORIZATION  	1
#define DIALOGUE_REGISTRATION   	2
#define DIALOGUE_CHOICE_GANG    	4
#define DIALOGUE_MENU           	5
#define DIALOGUE_COMMAND        	6
#define DIALOGUE_SETTING        	8
#define DIALOGUE_REPORT         	9
#define DIALOGUE_CHANGE_NAME    	10
#define DIALOGUE_DONAT              11
#define DIALOGUE_WAREHOUSE      	12
#define DIALOGUE_SECURITY_SETTINGS 	14
#define DIALOGUE_CHANGE_PASSWORD    15
#define DIALOGUE_SERVER_SETTING     17
#define DIALOGUE_TELEPORT_EVENT     18
#define DIALOGUE_RADIO              19
#define DIALOGUE_CHANGE_SKIN_GROVE  20
#define DIALOGUE_CHANGE_SKIN_BALLAS 21
#define DIALOGUE_CHANGE_SKIN_VAGOS  22
#define DIALOGUE_CHANGE_SKIN_AZTEC  23
#define DIALOGUE_CHANGE_SKIN_RIFA   24
#define DIALOGUE_STATISTIC      	25
#define DIALOGUE_RULES          	26

#define COLOR_DARKORANGE        	0xFF6600FF
#define COLOR_LIGHTGREY         	0xB4B5B7FF
#define COLOR_BLUE              	0x319AFFFF
#define COLOR_RED               	0xFF6347AA
#define COLOR_YELLOW            	0xFFFF00AA
#define COLOR_GROVE             	0x009900AA
#define COLOR_BALLAS            	0xCC00FFAA
#define COLOR_AZTECAS           	0x00b4e1AA
#define COLOR_VAGOS             	0xffcd00AA
#define COLOR_RIFA              	0x6666ffAA

enum player_information
{
	p_id,
	p_name[MAX_PLAYER_NAME],
	p_password[15],
	p_rip[16],
	p_lip[16],
	p_rdata[32],
	p_admin,
	p_kills,
	p_deaths,
	p_mute,
	p_jail,
	p_donat,
	p_all_donat,
	p_chat_standard,
    p_chat_organization,
    p_nick_in_chat,
	p_nick_over_player,
 	p_id_in_chat,
 	p_in_game,
 	p_in_game_second,
 	p_vip
}
new p_info[MAX_PLAYERS][player_information];

enum player_virable
{
	p_gang,
	p_heal,
	p_mask
};
new p_virable[MAX_PLAYERS][player_virable];

enum gangzone_information
{
    gz_id,
    Float:gz_coords[4],
    gz_gang
}
new gz_info[MAX_GANGZONE][gangzone_information];
//Прочие
new
	database,
    total_gangzone,
    gangzone[5],
    bool: watch_pm,
    bool: anti_sbiv,
    bool: anti_mat,
    bool: overall_chat,
    bool: connect_ip_show,
    bool: capture_on_off,
    bool: set_score,
	bool: anti_spawnkill,
    bool: pay_day,
	teleport_the_event,
    Menu: spectrate_menu,
    name_zone[MAX_ZONE_NAME],
	payday_donat[MAX_PLAYERS],
	payday_kills[MAX_PLAYERS],
	Float: health_godmod_test,
    p_ip[MAX_PLAYERS],
    afk_time[MAX_PLAYERS char],
    authorization[MAX_PLAYERS char],
   	spectrate_player_id[MAX_PLAYERS] = {INVALID_PLAYER_ID, ...};
//ТекстДравы и тексты
new
	Text: logotyp_TD,
	Text: capture_textdraw[5],
	Text: monitoring_TD[11];
//Пикапы
new
    grove_input_output[2],
    ballas_input_output[2],
    vagos_input_output[2],
    aztecas_input_output[2],
	rifa_input_output[2],
//Динамические чекпоинты
	warehouse_dynamic_CP[5];
//Автомобили
new
    grove_car[5],
    ballas_car[7],
    aztecas_car[7],
    vagos_car[5],
    rifa_car[8];
//Система капта
new
    there_is_capture,
    time_to_expiration_capture,
    kills_team[2],
    capture_start,
    team_capture[2];
static const grove_skins[] =
	{86, 105, 106, 107, 149, 195, 269, 270, 271};
static const ballas_skins[] =
	{102, 103, 104, 195};
static const vagos_skins[] =
	{108, 109, 110, 190};
static const aztecas_skins[] =
	{114, 115, 116, 193, 292};
static const rifa_skins[] =
	{173, 174, 175, 226, 273};
static const organization_name[][] =
	{"Grove Street", "The Ballas", "Los Santos Vagos", "Varios Los Aztecas", "The Rifa"};
static const reduced_organization_name[][] =
	{"GROVE", "BALLAS", "VAGOS", "AZTECAS", "RIFA"};
static const organization_rang_name[5][10][32] = {
	{"Newman", "Hustla", "Huckster", "True", "Warrior", "Gangsta", "O.G", "Big Bro", "Legend", "Daddy"},
	{"Baby", "Tested", "Cracker", "Nigga", "Big Nigga", "Gangster", "Defender", "Shooter", "Star", "Big Daddy"},
	{"Mamarracho", "Compinche", "Bandito", "Vato Loco", "Chaval", "Forajido", "Veterano", "Elite", "El Orgullo", "Padre"},
	{"Novato", "Amigo", "Asistente", "Asesino", "Latinos", "Mejor", "Empresa", "Aproximado", "Diputado", "Padre"},
	{"Amigo", "Macho", "Junior", "Ermanno", "Bandido", "Autoridad", "Adjunto", "Veterano", "Vato Loco", "Padre"}};
static const swear_words[][] =
	{"сука", "с у к а", "с.у.к.а", "пиздец", "п и з д е ц", "п.и.з.д.е.ц", "мамку", "м а м к у", "м.а.м.к.у", "ебал", "е б а л", "е.б.а.л"};
static const rules[][] = {
{"{FFCC00}1. Основное{FFFFFF}\n"},
{"- Запрещено использовать любые читы, трейнеры, моды или CLEO скрипты\n"},
{"- Запрещен DeathMatch (DM) - Убийство и нанесение вреда игрокам без причины\n"},
{"- Запрещено убивать игроков на спавне (на месте, где они появляются в игре)\n"},
{"- Запрещены убийства путём наезда на него или стрельба из авто\n"},
{"- Запрещено уходить на паузу в целях спасения от нападающих\n"},
{"- Запрещено использования возможностей сервера для создания неудобств другим игрокам\n\n"},
{"{FFCC00}2. Процесс общения{FFFFFF}\n"},
{"- Запрещён мат, оскорбление других игроков\n"},
{"- Запрещены угрозы другим игрокам (не относящиеся к игровому процессу)\n"},
{"- Запрещено писать транслитом (например \"ya zawel na server\"\n"},
{"- Запрещена любая реклама сторонних ресурсов\n"},
{"- Запрещено флудить (часто повторять одинаковые фразы, или фразы без смысловой нагрузки)\n\n"},
{"{FFCC00}3. Администрация{FFFFFF}\n"},
{"- Необходимо сообщать администрации сервера о любых случаях нарушения данных правил\n"},
{"- Администрация самостоятельно выбирает штрафные санкции для каждого конкретного случая\n"},
{"- Санкции могут применяться сразу после нарушения или через время (например, впоследствии поступления жалобы)\n"},
{"- Если штрафная санкция была применена к вам ошибочно, свяжитесь с администрацией"}};

forward OnPlayerAccountCheck(playerid);
forward OnPlayerAccountLoad(playerid);
forward OnPlayerAccountCheckAdmin(playerid, player_name[]);
forward OnPlayerChangePassword(name[], base[], pass[]);
forward OnPlayerChangeName(playerid, inputtext[]);
forward OnPlayerKick(playerid);
forward OnPlayerTop(playerid);
forward OnGZLoad();
forward OnGZSave(i);
forward OnSquared(playerid, Float:min_x, Float:min_y, Float:max_x, Float:max_y);
forward SendAdminMessage(color, string[]);
forward SendVIPMessage(color, string[]);
forward SendGhettoMessage(family, color, string[]);
forward OnPlayerSbivAnimation(playerid, pos_x, pos_y, pos_z);
forward OnPlayerGodModTest(playerid, for_playerid, Float: healt_before_explosion);
forward OnPlayerUnban(playerid, nick[]);
forward OnPlayerAccountCheckBan(playerid);
forward OnServerRestarting();
forward OnPlayerAccountAdminCheck(playerid);

main()
{

}

public OnGameModeInit()
{
    database = mysql_connect(MYSQL_HOST, MYSQL_USER, MYSQL_BASE, MYSQL_PASS);
	mysql_function_query(database, "SELECT * FROM gangzone", true, "OnGZLoad", "");

    SendRconCommand("hostname "HOST_NAME"");
    SetGameModeText(""MODE_NAME"");
    SendRconCommand("weburl "SITE_NAME"");
	SendRconCommand("rcon_password "RCON_PASSWORD"");
	SendRconCommand("language Russian");

    SetNameTagDrawDistance(30.0);
	EnableStuntBonusForAll(0);
	//ManualVehicleEngineAndLights();
	DisableInteriorEnterExits();
	AllowInteriorWeapons(0);
	LimitGlobalChatRadius(16.0);
	LimitPlayerMarkerRadius(14.0);
	ShowPlayerMarkers(PLAYER_MARKERS_MODE_STREAMED);

	spectrate_menu = CreateMenu("_", 1, 500.0, 150.0, 100.0 );
	AddMenuItem(spectrate_menu, 0, "-EXIT-");
	AddMenuItem(spectrate_menu, 0, "Skick");
	AddMenuItem(spectrate_menu, 0, "Slap");
	AddMenuItem(spectrate_menu, 0, "GMTest");
	AddMenuItem(spectrate_menu, 0, "Info");
	AddMenuItem(spectrate_menu, 0, "Stats");
	AddMenuItem(spectrate_menu, 0, "Update");
	AddMenuItem(spectrate_menu, 0, "-EXIT-");

	Create3DTextLabel("Grove Street", 0x009900FF, 2514.3403,-1691.5911,14.0460+1, 10, 0, 1);
	Create3DTextLabel("The Ballas", 0xCC00FFFF, 2022.9318,-1120.2645,26.4210+1, 10, 0, 1);
	Create3DTextLabel("Los Santos Vagos", 0xffcd00FF, 2756.3645,-1182.8091,69.4035+1, 10, 0, 1);
	Create3DTextLabel("Varios Los Aztecas", 0x00B4E1FF, 2185.7717,-1815.2280,13.5469+1, 10, 0, 1);
	Create3DTextLabel("The Rifa", 0x6666FFFF, 2787.0764,-1926.1918,13.5469+1, 10, 0, 1);

    warehouse_dynamic_CP[0] = CreateDynamicCP(2455.5740,-1706.3229,1013.5078, 1.0, 2, 2, -1, 25.0);//GROVE WAREHOUSE
    warehouse_dynamic_CP[1] = CreateDynamicCP(-42.5511,1412.5063,1084.4297, 1.0, 2, 8, -1, 25.0);//BALLAS WAREHOUSE
    warehouse_dynamic_CP[2] = CreateDynamicCP(333.0990,1118.9160,1083.8903, 1.0, 2, 5, -1, 25.0);//VAGOS WAREHOUSE
    warehouse_dynamic_CP[3] = CreateDynamicCP(223.0524,1249.5559,1082.1406, 1.0, 2, 2, -1, 25.0);//AZTECAS WAREHOUSE
    warehouse_dynamic_CP[4] = CreateDynamicCP(-71.8009,1366.5933,1080.2185, 1.0, 2, 6, -1, 25.0);//RIFA WAREHOUSE
    
	grove_input_output[0] = CreatePickup(1318,23,2495.4309,-1691.1400,14.7656);//GROVE ENTER
	grove_input_output[1] = CreatePickup(1318,23,2468.4163,-1698.2432,1013.5078,2);//GROVE EXIT
	ballas_input_output[0] = CreatePickup(1318,23,2022.8790,-1120.2637,26.4210);//BALLAS ENTER
	ballas_input_output[1] = CreatePickup(1318,23,-42.6055,1405.7949,1084.4297,2);//BALLAS EXIT
	vagos_input_output[0] = CreatePickup(1318,23,2756.2825,-1182.4691,69.3998);//VAGOS ENTER
	vagos_input_output[1] = CreatePickup(1318,23,318.6152,1114.8966,1083.8828,2);//VAGOS EXIT
	aztecas_input_output[0] = CreatePickup(1318,23,2185.8176,-1814.6786,13.5469);//AZTECAS ENTER
	aztecas_input_output[1] = CreatePickup(1318,23,225.756989,1240.000000,1082.149902,2);//AZTECAS EXIT
	rifa_input_output[0] = CreatePickup(1318,23,2787.0759,-1926.1780,13.5469);//RIFA ENTER
	rifa_input_output[1] = CreatePickup(1318,23,-68.8279,1351.3553,1080.2109, 2);//RIFA EXIT

	grove_car[0] = AddStaticVehicleEx(492,2493.8000500,-1681.1999500,13.2000000,0.0000000,86,86,TIME_SPAWN_CAR);
	grove_car[1] = AddStaticVehicleEx(492,2489.6001000,-1680.8000500,13.2000000,0.0000000,86,86,TIME_SPAWN_CAR);
	grove_car[2] = AddStaticVehicleEx(492,2485.8000500,-1680.6999500,13.2000000,0.0000000,86,86,TIME_SPAWN_CAR);
	grove_car[3] = AddStaticVehicleEx(492,2475.5000000,-1676.5000000,13.2000000,328.0000000,86,86,TIME_SPAWN_CAR);
	grove_car[4] = AddStaticVehicleEx(492,2472.3999000,-1671.5000000,13.2000000,307.9970000,86,86,TIME_SPAWN_CAR);

	ballas_car[0] = AddStaticVehicleEx(491,2036.1999500,-1128.9000200,24.4000000,270.0000000,147,147,TIME_SPAWN_CAR);
	ballas_car[1] = AddStaticVehicleEx(491,2029.0999800,-1129.0000000,24.6000000,270.0000000,147,147,TIME_SPAWN_CAR);
	ballas_car[2] = AddStaticVehicleEx(491,2018.4000200,-1128.5999800,24.9000000,270.0000000,147,147,TIME_SPAWN_CAR);
	ballas_car[3] = AddStaticVehicleEx(491,2015.5999800,-1143.3000500,25.0000000,272.0000000,147,147,TIME_SPAWN_CAR);
	ballas_car[4] = AddStaticVehicleEx(491,2024.0999800,-1143.0999800,24.7000000,272.0000000,147,147,TIME_SPAWN_CAR);
	ballas_car[5] = AddStaticVehicleEx(491,2032.8000500,-1143.0000000,24.5000000,272.0000000,147,147,TIME_SPAWN_CAR);
	ballas_car[6] = AddStaticVehicleEx(491,2040.8000500,-1143.1999500,24.2000000,272.0000000,147,147,TIME_SPAWN_CAR);

	aztecas_car[0] = AddStaticVehicleEx(534,2168.8999000,-1807.0000000,13.2000000,0.0000000,165,165,TIME_SPAWN_CAR);
	aztecas_car[1] = AddStaticVehicleEx(534,2165.1001000,-1806.9000200,13.2000000,0.0000000,165,165,TIME_SPAWN_CAR);
	aztecas_car[2] = AddStaticVehicleEx(534,2161.1001000,-1806.9000200,13.2000000,0.0000000,165,165,TIME_SPAWN_CAR);
	aztecas_car[3] = AddStaticVehicleEx(534,2157.1001000,-1807.0000000,13.2000000,0.0000000,165,165,TIME_SPAWN_CAR);
	aztecas_car[4] = AddStaticVehicleEx(534,2173.1001000,-1806.6999500,13.2000000,0.0000000,165,165,TIME_SPAWN_CAR);
	aztecas_car[5] = AddStaticVehicleEx(536,2159.3000500,-1792.9000200,13.2000000,270.0000000,165,165,TIME_SPAWN_CAR);
	aztecas_car[6] = AddStaticVehicleEx(536,2159.1001000,-1797.0000000,13.2000000,270.0000000,165,165,TIME_SPAWN_CAR);

    vagos_car[0] = AddStaticVehicleEx(467,2761.1113,-1177.4034,69.1072,90.9622,6,1,TIME_SPAWN_CAR);
	vagos_car[1] = AddStaticVehicleEx(474,2742.7019,-1188.0476,69.0791,0.6235,6,6,TIME_SPAWN_CAR);
	vagos_car[2] = AddStaticVehicleEx(474,2742.1958,-1166.2170,69.1452,2.7342,6,6,TIME_SPAWN_CAR);
	vagos_car[3] = AddStaticVehicleEx(474,2742.1863,-1149.0377,69.2538,0.2541,6,6,TIME_SPAWN_CAR);
	vagos_car[4] = AddStaticVehicleEx(474,2742.0378,-1134.9971,69.2553,0.2727,6,6,TIME_SPAWN_CAR);

	rifa_car[0] = AddStaticVehicleEx(439,2774.0278,-1907.8258,11.6699,0.3627,198,198,TIME_SPAWN_CAR);
	rifa_car[1] = AddStaticVehicleEx(439,2774.1218,-1919.3033,12.9702,1.0832,198,198,TIME_SPAWN_CAR);
	rifa_car[2] = AddStaticVehicleEx(439,2774.0767,-1932.5342,13.3059,0.4862,198,198,TIME_SPAWN_CAR);
	rifa_car[3] = AddStaticVehicleEx(439,2774.3379,-1950.8381,13.3063,1.4531,198,198,TIME_SPAWN_CAR);
	rifa_car[4] = AddStaticVehicleEx(566,2763.9497,-1911.0905,11.9163,0.3543,198,198,TIME_SPAWN_CAR);
	rifa_car[5] = AddStaticVehicleEx(566,2764.1392,-1923.2371,13.1346,0.6155,198,198,TIME_SPAWN_CAR);
	rifa_car[6] = AddStaticVehicleEx(566,2764.4043,-1935.8153,13.1914,0.3832,198,198,TIME_SPAWN_CAR);
	rifa_car[7] = AddStaticVehicleEx(566,2764.5476,-1945.1934,13.1941,0.4081,198,198,TIME_SPAWN_CAR);
	
	//2471.653,-1666.610,13.093 466 grove
	//2472.430,-1670.518,13.069 466
	//2473.458,-1674.347,13.078 466
	//2482.597,-1681.337, 13.114 492
	//2487.677,-1681.145,13.105 492
	//2493.263,-1680.945,13.120 492
	//2497.882,-1679.399,13.132 492

	//2043.961,-1128.734,24.118 421 ballas
	//2035.909,-1128.601,24.353 421
	//2028.154,-1128.810,24.528 421
	//2017.760,-1128.566,24.781 491
	//2008.140,-1130.465,24.944 491
	//2016.766,-1143.174,24.691 491
	//2030.233,-1145.549,24.360 491

	//2171.115,-1803.248,12.980 575 aztecas
	//2180.762,-1807.061,12.961 575
	//2178.734,-1808.650,13.101 567
	//2188.351,-1805.005,13.132 534
	//2188.363,-1795.986,13.128 534
	//2188.400,-1786.999,13.124 534
	//1 тачки нету 567 id

	//2766.122,-1954.357,13.206 439 rifa
	//2766.122,-1945.307,13.206 439
	//2766.120,-1935.962,13.212 439
	//2763.808,-1925.821,13.370 439
	//2772.775,-1944.273,13.100 566
	//2772.700,-1928.766,13.125 566
	//2772.692,-1919.447,12.767 533
	//2772.824,-1911.280,11.790 533

	SetTimer("@__OnEverySecondTimer", 1000, true);
	
    OnServerTD();

    overall_chat = true;
    anti_sbiv = true;
    anti_sbiv = false;
    anti_spawnkill = true;
    watch_pm = false;
    connect_ip_show = false;
    capture_on_off = true;

	AddPlayerClass(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
	return true;
}

public OnGameModeExit()
{
	ExtraSaveAccount();
    //mysql_close(database);
	return true;
}

public OnPlayerRequestClass(playerid, classid)
{
    SendClientMessage(playerid, COLOR_BLUE, "Добро пожаловать на "SERVER_NAME"!");
	return true;
}

public OnPlayerConnect(playerid)
{
    TextDrawShowForPlayer(playerid, logotyp_TD);
    PreloadAllAnimLibs(playerid);
    OnPlayerRemoveInfo(playerid);
	GetPlayerName(playerid, p_info[playerid][p_name], MAX_PLAYER_NAME);
	GetPlayerIp(playerid, p_ip[playerid], 16);

	static const fmt_str[] = "SELECT * FROM `accounts` WHERE `name` = '%s'";
   	new mysql_str[sizeof fmt_str + 44 + MAX_PLAYER_NAME];
	format(mysql_str, sizeof(mysql_str), fmt_str, p_info[playerid][p_name]);
	mysql_function_query(database, mysql_str, true, "OnPlayerAccountCheck", "i", playerid);
	
	if(connect_ip_show == true)
	{
	    static const fmt_ip[] = "[A] %s[%d] подключился. IP: %s";
	    new str[sizeof fmt_ip + 27 + MAX_PLAYER_NAME + 16];
	    format(str, sizeof(str), fmt_ip, p_info[playerid][p_name], playerid, p_ip[playerid]);
	    SendAdminMessage(COLOR_YELLOW, str);
	    return true;
	}
	return true;
}

public OnPlayerDisconnect(playerid, reason)
{
    TextDrawHideForPlayer(playerid, logotyp_TD);
    OnPlayerAccountSave(playerid);
    OnPlayerRemoveInfo(playerid);
	return true;
}

public OnRconLoginAttempt(ip[], password[], success)
{
    if(!success)
    {
        foreach(new i: Player)
	 	{
			static const fmt_str[] = "[A] %s[%d] неверно ввёл RCON пароль и был кикнут";
   			new str[sizeof fmt_str + 47 + MAX_PLAYER_NAME];
	    	format(str, sizeof(str), fmt_str, p_info[i][p_name], i);
			SendAdminMessage(0xFF0000AA, str);
	  		KickEx(i);
	    	return false;
	    }
    }
	return true;
}

public OnPlayerSpawn(playerid)
{
	SetPlayerScore(playerid, p_info[playerid][p_kills]);
    for(new i = 0; i != sizeof(gz_info); i++) GangZoneShowForPlayer(playerid, gz_info[i][gz_id], OnGZColor(gz_info[i][gz_gang]));
    if(!GetPVarInt(playerid, "logged"))
	{
		ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "{FF9900}Ошибка", "Для игры на сервере Вы должны авторизоваться", "Закрыть", "");
		SendClientMessage(playerid, COLOR_DARKORANGE, "Введите /q (/quit) чтобы выйти");
		SendClientMessage(playerid, COLOR_DARKORANGE, "Для игры на сервере Вы должны авторизироваться");
		KickEx(playerid);
		return true;
	}
	switch(p_virable[playerid][p_gang])
	{
 		case 1:
		{
			SetPlayerPos(playerid, 2466.6086,-1698.4858,1013.5078);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerInterior(playerid, 2);
			SetPlayerSkin(playerid, grove_skins[random(9)]);
		}
  		case 2:
    	{
			SetPlayerPos(playerid, -49.8575,1408.5522,1084.4297);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerInterior(playerid, 8);
			SetPlayerSkin(playerid, ballas_skins[random(4)]);
		}
  		case 3:
		{
			SetPlayerPos(playerid, 321.0667,1123.1947,1083.8828);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerInterior(playerid, 5);
			SetPlayerSkin(playerid, vagos_skins[random(4)]);
		}
		case 4:
		{
			SetPlayerPos(playerid, 219.6040,1241.9434,1082.1406);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerInterior(playerid, 2);
			SetPlayerSkin(playerid, aztecas_skins[random(5)]);
		}
		case 5:
		{
			SetPlayerPos(playerid, -59.1456,1364.5851,1080.2109);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerInterior(playerid, 6);
			SetPlayerSkin(playerid, rifa_skins[random(5)]);
		}
	}
	if(p_info[playerid][p_jail] > 0)
	{
		switch(p_virable[playerid][p_gang])
		{
	 		case 1:
			{
			    SetPlayerPos(playerid, 264.1425, 77.4712, 1001.0391);
			    SetPlayerFacingAngle(playerid, 263.0160);
			    SetPlayerInterior(playerid, 6);
			    SetPlayerVirtualWorld(playerid, 11);
			}
			case 2:
			{
			    SetPlayerPos(playerid, 264.1425, 77.4712, 1001.0391);
			    SetPlayerFacingAngle(playerid, 263.0160);
			    SetPlayerInterior(playerid, 6);
			    SetPlayerVirtualWorld(playerid, 12);
			}
			case 3:
			{
			    SetPlayerPos(playerid, 264.1425, 77.4712, 1001.0391);
			    SetPlayerFacingAngle(playerid, 263.0160);
			    SetPlayerInterior(playerid, 6);
			    SetPlayerVirtualWorld(playerid, 13);
			}
			case 4:
			{
			    SetPlayerPos(playerid, 264.1425, 77.4712, 1001.0391);
			    SetPlayerFacingAngle(playerid, 263.0160);
			    SetPlayerInterior(playerid, 6);
			    SetPlayerVirtualWorld(playerid, 14);
			}
			case 5:
			{
			    SetPlayerPos(playerid, 264.1425, 77.4712, 1001.0391);
			    SetPlayerFacingAngle(playerid, 263.0160);
			    SetPlayerInterior(playerid, 6);
			    SetPlayerVirtualWorld(playerid, 15);
			}
		}
	}
	return true;
}

public OnPlayerDeath(playerid, killerid, reason)
{
	if(killerid != INVALID_PLAYER_ID)
	{
	    SendDeathMessage(killerid, playerid, reason);
		switch(p_virable[playerid][p_gang])
		{
		    case 1: SetPlayerColor(playerid, COLOR_GROVE);
		    case 2: SetPlayerColor(playerid, COLOR_BALLAS);
		    case 3: SetPlayerColor(playerid, COLOR_VAGOS);
		    case 4: SetPlayerColor(playerid, COLOR_AZTECAS);
		    case 5: SetPlayerColor(playerid, COLOR_RIFA);
		}
		p_info[playerid][p_deaths]++;
		p_info[killerid][p_kills]++;
		p_virable[playerid][p_mask] = 0;
		p_virable[playerid][p_heal] = 0;
	    SetPlayerScore(killerid, p_info[killerid][p_kills]);
		if(GetPlayerState(killerid) == PLAYER_STATE_DRIVER)
		{
			SendClientMessage(killerid, COLOR_DARKORANGE, "Убийство с транспорта запрещено!");
			KickEx(killerid);
			return true;
		}
	    if(there_is_capture == 1)
		{
		    if(p_virable[killerid][p_gang] == team_capture[0] && p_virable[playerid][p_gang] == team_capture[1])
		    {
				kills_team[0] += 1;
			}
			else if(p_virable[killerid][p_gang] == team_capture[1] && p_virable[playerid][p_gang] == team_capture[0])
			{
				kills_team[1] += 1;
			}
		}
	}
	return true;
}

public OnPlayerText(playerid, text[])
{
	new
	    string[(26)+(156)+(MAX_PLAYER_NAME)];
    if(!GetPVarInt(playerid, "logged")) return false;
    if(p_info[playerid][p_mute] > 0)
	{
	    SetPlayerChatBubble(playerid, "Пытается что-то сказать...", COLOR_RED, 20.0, 10000);
		SendClientMessage(playerid, 0xFF6600AA, "Доступ в чат заблокирован. Узнать время до окончания бана чата {66CC33}/time");
		return false;
	}
	if(anti_mat == true)
	{
		for(new s; s < sizeof(swear_words); s++)
		{
			new
				text_;
			while((text_ = strfind(text, swear_words[s], true)) != -1) for(new i = text_, j = text_ + strlen(swear_words[s]); i < j; i++)
			{
				text[i] = '*';
			}
		}
	}
	switch(p_info[playerid][p_chat_standard])
	{
		case 1: //Чат "Advance"
 		{
			switch(p_virable[playerid][p_gang])
			{
				case 0: return false;
				case 1: format(string, sizeof(string), "{FFFFFF}- %s {009900}(%s)[%d]", text, p_info[playerid][p_name], playerid);
  				case 2: format(string, sizeof(string), "{FFFFFF}- %s {CC00FF}(%s)[%d]", text, p_info[playerid][p_name], playerid);
			    case 3: format(string, sizeof(string), "{FFFFFF}- %s {ffcd00}(%s)[%d]", text, p_info[playerid][p_name], playerid);
			    case 4: format(string, sizeof(string), "{FFFFFF}- %s {00b4e1}(%s)[%d]", text, p_info[playerid][p_name], playerid);
			    case 5: format(string, sizeof(string), "{FFFFFF}- %s {6666ff}(%s)[%d]", text, p_info[playerid][p_name], playerid);
			}
			SetPlayerChatBubble(playerid, text, -1, 20.0, 10000);
			OnPlayerDistanceChat(playerid, 20.0, string);
		}
		case 2: //Чат "Отключен"
		{
			return false;
		}
		case 3: //Чат "Стандартный"
		{
			format(string, sizeof(string), "%s{FFFFFF}(%d): %s", p_info[playerid][p_name], playerid, text);
			SetPlayerChatBubble(playerid, text, 0x00ccffAA, 15.0, 5000);
			foreach(new i: Player)
			{
				SendClientMessage(i, GetPlayerColor(playerid), string);
			}
		}
	}
	return false;
}

public OnPlayerPickUpPickup(playerid, pickupid)
{
	if(pickupid == grove_input_output[0])
	{
	    if(p_virable[playerid][p_gang] == 1)
	    {
			SetPlayerPos(playerid, 2466.6086,-1698.4858,1013.5078);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerInterior(playerid, 2);
		}
		else
		{
			SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет доступа ко входу");
		}
	}
	if(pickupid == grove_input_output[1])
	{
		SetPlayerPos(playerid, 2495.3022,-1688.5438,13.8722);
		SetPlayerFacingAngle(playerid, 0);
		SetPlayerVirtualWorld(playerid, 0);
		SetPlayerInterior(playerid, 0);
	}
	if(pickupid == ballas_input_output[0])
	{
	    if(p_virable[playerid][p_gang] == 2)
	    {
			SetPlayerPos(playerid, -42.6860,1408.4878,1084.4297);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerInterior(playerid, 8);
		}
		else
		{
		    SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет доступа ко входу");
		}
	}
	if(pickupid == ballas_input_output[1])
	{
		SetPlayerPos(playerid, 2022.9169,-1122.7472,26.2329);
		SetPlayerFacingAngle(playerid, 0);
		SetPlayerInterior(playerid, 0);
		SetPlayerVirtualWorld(playerid, 0);
	}
	if(pickupid == vagos_input_output[0])
	{
	    if(p_virable[playerid][p_gang] == 3)
	    {
			SetPlayerPos(playerid, 318.564971,1118.209960,1083.882812);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerInterior(playerid, 5);
		}
		else
		{
			SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет доступа ко входу");
		}
	}
	if(pickupid == vagos_input_output[1])
	{
		SetPlayerPos(playerid, 2756.1492,-1180.2386,69.3978);
		SetPlayerFacingAngle(playerid, 0);
		SetPlayerVirtualWorld(playerid, 0);
		SetPlayerInterior(playerid, 0);
	}
	if(pickupid == aztecas_input_output[0])
	{
	    if(p_virable[playerid][p_gang] == 4)
	    {
		    SetPlayerPos(playerid, 223.0174,1240.1416,1082.1406);
		    SetPlayerFacingAngle(playerid, 0);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerInterior(playerid, 2);
		}
		else
		{
		    SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет доступа ко входу");
		}
	}
	if(pickupid == aztecas_input_output[1])
	{
	    SetPlayerPos(playerid, 2185.6555,-1812.5112,13.5650);
	    SetPlayerFacingAngle(playerid, 0);
	    SetPlayerVirtualWorld(playerid, 0);
		SetPlayerInterior(playerid, 0);
	}
	if(pickupid == rifa_input_output[0])
	{
	    if(p_virable[playerid][p_gang] == 5)
	    {
		    SetPlayerPos(playerid, -68.9146,1353.8420,1080.2109);
			SetPlayerFacingAngle(playerid, 0);
			SetPlayerVirtualWorld(playerid, 2);
			SetPlayerInterior(playerid, 6);
		}
		else
		{
			SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет доступа ко входу");
		}
	}
	if(pickupid == rifa_input_output[1])
	{
	    SetPlayerPos(playerid, 2784.5544,-1926.1563,13.5469);
		SetPlayerFacingAngle(playerid, 0);
		SetPlayerVirtualWorld(playerid, 0);
		SetPlayerInterior(playerid, 0);
	}
	return true;
}

public OnPlayerEnterDynamicCP(playerid, checkpointid)
{
    if(checkpointid == warehouse_dynamic_CP[0])
   	{
        if(p_virable[playerid][p_gang] == 1)
        {
        	ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
        }
        else
        {
            SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы не можете пользоваться этим складом");
        }
    }
    if(checkpointid == warehouse_dynamic_CP[1])
   	{
        if(p_virable[playerid][p_gang] == 2)
        {
        	ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
        }
        else
        {
            SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы не можете пользоваться этим складом");
        }
    }
    if(checkpointid == warehouse_dynamic_CP[2])
   	{
        if(p_virable[playerid][p_gang] == 3)
        {
        	ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
        }
        else
        {
            SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы не можете пользоваться этим складом");
        }
    }
    if(checkpointid == warehouse_dynamic_CP[3])
   	{
        if(p_virable[playerid][p_gang] == 4)
        {
        	ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
        }
        else
        {
            SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы не можете пользоваться этим складом");
        }
    }
    if(checkpointid == warehouse_dynamic_CP[4])
   	{
        if(p_virable[playerid][p_gang] == 5)
        {
        	ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
        }
        else
        {
            SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы не можете пользоваться этим складом");
        }
    }
	return true;
}

public OnPlayerUpdate(playerid)
{
    if(afk_time{playerid} > 0) afk_time{playerid} = 0;
	return true;
}

public OnPlayerTakeDamage(playerid, issuerid, Float:amount, weaponid)
{
	static const fmt_str[] = "-%.0f HP";
	new str[sizeof fmt_str + 11];
	format(str, sizeof(str), fmt_str, amount);
	SetPlayerChatBubble(playerid, str, -1 , 100.0, 2000);
	return true;
}

public OnDialogResponse(playerid, dialogid, response, listitem, inputtext[])
{
	switch(dialogid)
	{
	    case DIALOGUE_REGISTRATION:
	    {
	        if(!response)
	        {
	            ShowPlayerDialog(playerid, DIALOGUE_REGISTRATION, DIALOG_STYLE_INPUT, "{66CCFF}Регистрация", "{FFFFFF}Добро пожаловать на сервер "SERVER_NAME"\nЧтобы начать игру вам необходимо пройти регистрацию\n\nВведите пароль для Вашего аккаунта\nОн будет запрашиваться каждый раз, когда вы заходите на сервер\n\n{66CC33}\tПримечания:\n\t- Пароль может состоять из русских и латинских символов\n\t- Пароль чувствителен к регистру\n\t- Длина пароля от 6-ти до 15-ти символов", "Далее", "");
	            return true;
	        }
	        if(!strlen(inputtext))
			{
				ShowPlayerDialog(playerid, DIALOGUE_REGISTRATION, DIALOG_STYLE_INPUT, "{66CCFF}Регистрация", "{FFFFFF}Добро пожаловать на сервер "SERVER_NAME"\nЧтобы начать игру вам необходимо пройти регистрацию\n\nВведите пароль для Вашего аккаунта\nОн будет запрашиваться каждый раз, когда вы заходите на сервер\n\n{66CC33}\tПримечания:\n\t- Пароль может состоять из русских и латинских символов\n\t- Пароль чувствителен к регистру\n\t- Длина пароля от 6-ти до 15-ти символов", "Далее", "");
	            return true;
			}
	        if(strlen(inputtext) < 6 || strlen(inputtext) > 15)
	        {
				ShowPlayerDialog(playerid, DIALOGUE_REGISTRATION, DIALOG_STYLE_INPUT, "{66CCFF}Регистрация", "{FFFFFF}Добро пожаловать на сервер "SERVER_NAME"\nЧтобы начать игру вам необходимо пройти регистрацию\n\nВведите пароль для Вашего аккаунта\nОн будет запрашиваться каждый раз, когда вы заходите на сервер\n\n{66CC33}\tПримечания:\n\t- Пароль может состоять из русских и латинских символов\n\t- Пароль чувствителен к регистру\n\t- Длина пароля от 6-ти до 15-ти символов", "Далее", "");
	            return true;
	        }
	        else
	        {
		        p_info[playerid][p_password][0] = EOS;
		        strins(p_info[playerid][p_password], inputtext, 0);
		        OnPlayerAccountCreate(playerid, p_info[playerid][p_password]);
		        return true;
		    }
	    }
	    case DIALOGUE_AUTHORIZATION:
	    {
	        if(!response)
			{
				SendClientMessage(playerid, COLOR_DARKORANGE, "Введите /q(uit) чтобы выйти");
				KickEx(playerid);
				return true;
			}
	        if(!strlen(inputtext))
	        {
				static const fmt_str[] = "{FFFFFF}Добро пожаловать на сервер "SERVER_NAME"\nВаш ник зарегистрирован\n\nЛогин: {66CC33}%s\n{FFFFFF}Введите пароль:";
				new str[sizeof fmt_str + 115 + MAX_PLAYER_NAME];
				format(str, sizeof(str), fmt_str, p_info[playerid][p_name]);
				ShowPlayerDialog(playerid, DIALOGUE_AUTHORIZATION, DIALOG_STYLE_INPUT, "{66CCFF}Авторизация", str, "Войти", "Отмена");
				return true;
	        }
	        if(!strcmp(p_info[playerid][p_password], inputtext))
	        {
                static const fmt_str[] = "SELECT * FROM `accounts` WHERE `name` = '%s'";
    			new mysql_str[sizeof fmt_str + 44 + MAX_PLAYER_NAME];
	            format(mysql_str, sizeof(mysql_str), fmt_str, p_info[playerid][p_name]);
	            mysql_function_query(database, mysql_str, true, "OnPlayerAccountLoad", "i", playerid);
	            return true;
	        }
	        else
	        {
				new
          			string[122+44+MAX_PLAYER_NAME];
				switch(GetPVarInt(playerid, "wrong_password"))
	            {
	                case 0:
	                {
		                format(string, sizeof(string), "{FFFFFF}Добро пожаловать на сервер Advance RolePlay\nВаш ник зарегистрирован\n\nЛогин: {66CC33}%s\n{FF3300}Неверный пароль! Осталось попыток: 3", p_info[playerid][p_name]);
						ShowPlayerDialog(playerid, DIALOGUE_AUTHORIZATION, DIALOG_STYLE_INPUT, "{66CCFF}Авторизация", string, "Войти", "Отмена");
	                }
	                case 1:
	                {
		                format(string, sizeof(string), "{FFFFFF}Добро пожаловать на сервер Advance RolePlay\nВаш ник зарегистрирован\n\nЛогин: {66CC33}%s\n{FF3300}Неверный пароль! Осталось попыток: 2", p_info[playerid][p_name]);
						ShowPlayerDialog(playerid, DIALOGUE_AUTHORIZATION, DIALOG_STYLE_INPUT, "{66CCFF}Авторизация", string, "Войти", "Отмена");
	                }
	                case 2:
	                {
		                format(string, sizeof(string), "{FFFFFF}Добро пожаловать на сервер Advance RolePlay\nВаш ник зарегистрирован\n\nЛогин: {66CC33}%s\n{FF3300}Неверный пароль! Осталось попыток: 1", p_info[playerid][p_name]);
						ShowPlayerDialog(playerid, DIALOGUE_AUTHORIZATION, DIALOG_STYLE_INPUT, "{66CCFF}Авторизация", string, "Войти", "Отмена");
						SendClientMessage(playerid, COLOR_DARKORANGE, "При неправильном вводе пароля Вы будете забанены");
	                }
	                default:
	                {
		   	            ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "{FF9900}Лимит попыток авторизации", "{FFFFFF}Вы ввели неправильный пароль 3 раза подряд. Ваш IP адрес забанен на сутки", "Закрыть", "");
						KickEx(playerid);
						return true;
	                }
	            }
	            SetPVarInt(playerid, "wrong_password", GetPVarInt(playerid, "wrong_password")+1);
	        }
	        return true;
	    }
	    case DIALOGUE_CHOICE_GANG:
	    {
            if(!response)
			{
				SendClientMessage(playerid, COLOR_DARKORANGE, "Введите /q(uit) чтобы выйти");
				KickEx(playerid);
				return true;
			}
			switch(listitem)
			{
			    case 0:
			    {
			        SendClientMessage(playerid, COLOR_BLUE, "Вы выбрали банду Grove Street");
					SetPlayerColor(playerid, COLOR_GROVE);
					p_virable[playerid][p_gang] = 1;
					SpawnPlayer(playerid);
			    }
			    case 1:
			    {
			        SendClientMessage(playerid, COLOR_BLUE, "Вы выбрали банду The Ballas");
					SetPlayerColor(playerid, COLOR_BALLAS);
					p_virable[playerid][p_gang] = 2;
					SpawnPlayer(playerid);
			    }
			    case 2:
			    {
			        SendClientMessage(playerid, COLOR_BLUE, "Вы выбрали банду Los Santos Vagos");
					SetPlayerColor(playerid, COLOR_VAGOS);
					p_virable[playerid][p_gang] = 3;
					SpawnPlayer(playerid);
			    }
			    case 3:
			    {
			        SendClientMessage(playerid, COLOR_BLUE, "Вы выбрали банду Varios Los Aztecas");
					SetPlayerColor(playerid, COLOR_AZTECAS);
					p_virable[playerid][p_gang] = 4;
					SpawnPlayer(playerid);
			    }
			    case 4:
			    {
			        SendClientMessage(playerid, COLOR_BLUE, "Вы выбрали банду The Rifa");
					SetPlayerColor(playerid, COLOR_RIFA);
					p_virable[playerid][p_gang] = 5;
					SpawnPlayer(playerid);
			    }
			}
	    }
	    case DIALOGUE_MENU:
	    {
	        if(!response) return true;
			switch(listitem)
			{
			    case 0: OnPlayerShowStatistic(playerid, playerid);
				case 1: ShowPlayerDialog(playerid, DIALOGUE_COMMAND, DIALOG_STYLE_LIST, "{FFCD00}Список команд", "{99CC00}1. Получить описание\n{FFFFFF}2. Общие команды\n3. Общение", "Выбрать", "Назад");
				case 2: OnPlayerShowSetting(playerid);
				case 3: ShowPlayerDialog(playerid, DIALOGUE_SECURITY_SETTINGS, DIALOG_STYLE_LIST, "{FFCD00}Настройки безопасности", "1. Информация о настройках\n2. Мобильный телефон\n3. 'Случайный' PIN-код\n4. Google Authenticator\n{00CC00}5. Изменить пароль\n{FFFFFF}6. Изменить 'случайный' PIN-код\n{0099FF}7. Статус безопасности\n{999999}8. Подтвердить Email", "Выбрать", "Назад");
				case 4: ShowPlayerDialog(playerid, DIALOGUE_REPORT, DIALOG_STYLE_INPUT, "{FFCD00}Связь с администрацией", "{FFFFFF}Введите своё сообщение для администрации сервера\nОно должно быть кратким и ясным\n\n{66CC66}Если вы хотите подать жалобу на игрока,\nобязательно укажите его ID и причину жалобы", "Отправить", "Назад");
				case 5: SendClientMessage(playerid, -1, "Улучшения");
				case 6: OnPlayerShowRules(playerid);
				case 7: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_NAME, DIALOG_STYLE_INPUT, "{FFCD00}Изменение имени", "{FFFFFF}Введите новое имя в поле ниже. Допустимы только латинские символы:", "Изменить", "Закрыть");
				case 8: SendClientMessage(playerid, -1, "-");
				case 9: mysql_function_query(database, "SELECT `name`, `kills` FROM `accounts` ORDER BY `kills` DESC LIMIT 10", true, "OnPlayerTop", "d", playerid);
			}
	    }
	    case DIALOGUE_COMMAND:
	    {
	        if(!response) return ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "1. Статистика\n2. Список команд\n3. Личные настройки\n4. Настройки безопасности\n5. Связь с администрацией\n6. Улучшение\n7. Правила сервера\n8. Изменить имя\n9. Дополнительно\n10. ТОП 10 игроков", "Выбрать", "Закрыть");
			switch(listitem)
			{
			    case 0: ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    case 1:
				{
				    ShowPlayerDialog(playerid, DIALOGUE_COMMAND, DIALOG_STYLE_LIST, "{FFCD00}Список команд", "{99CC00}1. Получить описание\n{FFFFFF}2. Общие команды\n3. Общение", "Выбрать", "Назад");
                    SendClientMessage(playerid, 0x99FF00AA, "/menu(/mn) /newgang /yes /no /cancel /tp /capture /mask /healme");
				}
			    case 2:
				{
				    ShowPlayerDialog(playerid, DIALOGUE_COMMAND, DIALOG_STYLE_LIST, "{FFCD00}Список команд", "{99CC00}1. Получить описание\n{FFFFFF}2. Общие команды\n3. Общение", "Выбрать", "Назад");
					SendClientMessage(playerid, 0x009900AA, "/sms /f /o /v");
				}
			}
	    }
		case DIALOGUE_COMMAND+1:
		{
		    if(!response) return ShowPlayerDialog(playerid, DIALOGUE_COMMAND, DIALOG_STYLE_LIST, "{FFCD00}Список команд", "{99CC00}1. Получить описание\n{FFFFFF}2. Общие команды\n3. Общение", "Выбрать", "Назад");
		    if(!strlen(inputtext))
	        {
	            ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
	            SendClientMessage(playerid, COLOR_LIGHTGREY, "Введите команду, например {00CC99}/menu");
	            return true;
	        }
		    if(!strcmp(inputtext, "/healme", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/healme {FFFFFF}- Использование аптечки (её можно получить на любом складе банде)");
			    return true;
			}
			if(!strcmp(inputtext, "/mask", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/mask {FFFFFF}- Надеть маску");
			    return true;
			}
			if(!strcmp(inputtext, "/menu", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/menu {FFFFFF}- Показывает основное меню игрока (личное меню)");
			    return true;
			}
			if(!strcmp(inputtext, "/mn", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/menu {FFFFFF}- Показывает основное меню игрока (личное меню)");
			    return true;
			}
			if(!strcmp(inputtext, "/time", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/time {FFFFFF}- Может показывать: время заключения под стражу, время блокировки чата");
			    return true;
			}
			if(!strcmp(inputtext, "/capture", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/capture {FFFFFF}- Начать захват нейтральной или занятой территории (для банд)");
			    return true;
			}
			if(!strcmp(inputtext, "/changeskin", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/changeskin {FFFFFF}- Для лидеров и заместителей: изменить внешность члена организации");
			    return true;
			}
			if(!strcmp(inputtext, "/sms", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/sms {FFFFFF}- Отправить SMS сообщение игроку");
			    return true;
			}
			if(!strcmp(inputtext, "/pm", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/pm {FFFFFF}- Отправить SMS сообщение игроку");
			    return true;
			}
			if(!strcmp(inputtext, "/f", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/f {FFFFFF}- Общий чат организации");
			    return true;
			}
			if(!strcmp(inputtext, "/o", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/o {FFFFFF}- Общий чат");
			    return true;
			}
			if(!strcmp(inputtext, "/v", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/v {FFFFFF}- VIP чат");
			    return true;
			}
			if(!strcmp(inputtext, "/yes", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/yes {FFFFFF}- Согласиться на предложение игрока (можно также нажать клавишу Y)");
			    return true;
			}
			if(!strcmp(inputtext, "/no", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/no {FFFFFF}- Отказаться от предложения игрока (можно также нажать клавишу N)");
			    return true;
			}
			if(!strcmp(inputtext, "/tp", true))
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, 0x66cc00AA, "/tp {FFFFFF}- Перемещение игрока на место проведения мероприятия [включается администратором сервера]");
			    return true;
			}
			else
			{
			    ShowPlayerDialog(playerid, DIALOGUE_COMMAND+1, DIALOG_STYLE_INPUT, "{99CC00}Описание команды", "{FFFFFF}Введите интересующую Вас команду\nДля получения её описания:", "Описание", "Назад");
			    SendClientMessage(playerid, COLOR_LIGHTGREY, "Неизвестная команда");
			}
		}
	    case DIALOGUE_SETTING:
	    {
	        if(!response) return ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "1. Статистика\n2. Список команд\n3. Личные настройки\n4. Настройки безопасности\n5. Связь с администрацией\n6. Улучшение\n7. Правила сервера\n8. Изменить имя\n9. Дополнительно\n10. ТОП 10 игроков", "Выбрать", "Закрыть");
	        switch(listitem)
	        {
	            case 0:
	            {
					switch(p_info[playerid][p_chat_standard])
					{
					    case 1: p_info[playerid][p_chat_standard] = 2, OnPlayerShowSetting(playerid);
					    case 2: p_info[playerid][p_chat_standard] = 3, OnPlayerShowSetting(playerid);
					    case 3: p_info[playerid][p_chat_standard] = 1, OnPlayerShowSetting(playerid);
					}
	            }
	            case 1:
	            {
        			switch(p_info[playerid][p_chat_organization])
					{
					    case 1: p_info[playerid][p_chat_organization] = 2, OnPlayerShowSetting(playerid);
					    case 2: p_info[playerid][p_chat_organization] = 1, OnPlayerShowSetting(playerid);
					}
	            }
	            case 2:
				{
        			switch(p_info[playerid][p_nick_over_player])
					{
					    case 1: p_info[playerid][p_nick_over_player] = 2, OnPlayerShowSetting(playerid);
					    case 2: p_info[playerid][p_nick_over_player] = 1, OnPlayerShowSetting(playerid);
					}
				}
	            case 3:
	            {
        			switch(p_info[playerid][p_nick_in_chat])
					{
					    case 1: p_info[playerid][p_nick_in_chat] = 2, OnPlayerShowSetting(playerid);
					    case 2: p_info[playerid][p_nick_in_chat] = 1, OnPlayerShowSetting(playerid);
					}
	            }
				case 4:
				{
        			switch(p_info[playerid][p_id_in_chat])
					{
					    case 1: p_info[playerid][p_id_in_chat] = 2, OnPlayerShowSetting(playerid);
					    case 2: p_info[playerid][p_id_in_chat] = 1, OnPlayerShowSetting(playerid);
					}
				}
				case 5:
				{
				    ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "{FFCD00}Сохранено", "{FFFFFF}Новые настройки будут автомотически устанавливаться после каждой авторизации", "Ок", "");
				    OnPlayerAccountSettingSave(playerid);
				}
	        }
	    }
		case DIALOGUE_SECURITY_SETTINGS:
		{
		    if(!response) return ShowPlayerDialog(playerid, DIALOGUE_SECURITY_SETTINGS, DIALOG_STYLE_LIST, "{FFCD00}Настройки безопасности", "1. Информация о настройках\n2. Мобильный телефон\n3. 'Случайный' PIN-код\n4. Google Authenticator\n{00CC00}5. Изменить пароль\n{FFFFFF}6. Изменить 'случайный' PIN-код\n{0099FF}7. Статус безопасности\n{999999}8. Подтвердить Email", "Выбрать", "Назад");
		    switch(listitem)
	        {
	            case 0: SendClientMessage(playerid, -1, "В разработке");
				case 1: SendClientMessage(playerid, -1, "В разработке");
				case 2: SendClientMessage(playerid, -1, "В разработке");
				case 3: SendClientMessage(playerid, -1, "В разработке");
				case 4: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_PASSWORD, DIALOG_STYLE_INPUT, "{FFCD00}Изменение пароля", "{FFFFFF}Введите Ваш текущий пароль в поле ниже:", "Далее", "Назад");
	        }
		}
		case DIALOGUE_CHANGE_PASSWORD:
		{
		    new
		        password[16];
		    if(!response) return ShowPlayerDialog(playerid, DIALOGUE_SECURITY_SETTINGS, DIALOG_STYLE_LIST, "{FFCD00}Настройки безопасности", "1. Информация о настройках\n2. Мобильный телефон\n3. 'Случайный' PIN-код\n4. Google Authenticator\n{00CC00}5. Изменить пароль\n{FFFFFF}6. Изменить 'случайный' PIN-код\n{0099FF}7. Статус безопасности\n{999999}8. Подтвердить Email", "Выбрать", "Назад");
			if(sscanf(inputtext, "s[15]", password)) return ShowPlayerDialog(playerid, DIALOGUE_CHANGE_PASSWORD, DIALOG_STYLE_INPUT, "{FFCD00}Изменение пароля", "{FFFFFF}Введите Ваш текущий пароль в поле ниже:", "Далее", "Назад");
            if(!strlen(inputtext))
            {
				SendClientMessage(playerid, COLOR_DARKORANGE, "Вы ввели неверный пароль");
				return false;
			}
			if(!strcmp(password, p_info[playerid][p_password], true))
			{
				ShowPlayerDialog(playerid, DIALOGUE_CHANGE_PASSWORD+1, DIALOG_STYLE_INPUT, "{FFCD00}Новый пароль", "{FFFFFF}Введите новый пароль в поле ниже:", "Низменить", "Отмена");
			}
			else
			{
				SendClientMessage(playerid, COLOR_DARKORANGE, "Вы ввели неверный пароль");
				return true;
			}
		}
		case DIALOGUE_CHANGE_PASSWORD+1:
		{
		    new
		        password[16];
		    if(!response) return ShowPlayerDialog(playerid, DIALOGUE_SECURITY_SETTINGS, DIALOG_STYLE_LIST, "{FFCD00}Настройки безопасности", "1. Информация о настройках\n2. Мобильный телефон\n3. 'Случайный' PIN-код\n4. Google Authenticator\n{00CC00}5. Изменить пароль\n{FFFFFF}6. Изменить 'случайный' PIN-код\n{0099FF}7. Статус безопасности\n{999999}8. Подтвердить Email", "Выбрать", "Назад");
			if(sscanf(inputtext, "s[15]", password))
			{
				ShowPlayerDialog(playerid, DIALOGUE_CHANGE_PASSWORD+1, DIALOG_STYLE_INPUT, "{FFCD00}Новый пароль", "{FFFFFF}Введите новый пароль в поле ниже:", "Низменить", "Отмена");
				SendClientMessage(playerid, COLOR_DARKORANGE, "Длина пароля должна быть от 6 до 15 символов");
				SendClientMessage(playerid, COLOR_DARKORANGE, "Также не допускается использование пробелов");
				return true;
			}
			if(!strlen(inputtext))
            {
				ShowPlayerDialog(playerid, DIALOGUE_CHANGE_PASSWORD+1, DIALOG_STYLE_INPUT, "{FFCD00}Новый пароль", "{FFFFFF}Введите новый пароль в поле ниже:", "Низменить", "Отмена");
				SendClientMessage(playerid, COLOR_DARKORANGE, "Длина пароля должна быть от 6 до 15 символов");
				SendClientMessage(playerid, COLOR_DARKORANGE, "Также не допускается использование пробелов");
				return false;
			}
			if(strlen(inputtext) < 6 || strlen(inputtext) > 15)
			{
				ShowPlayerDialog(playerid, DIALOGUE_CHANGE_PASSWORD+1, DIALOG_STYLE_INPUT, "{FFCD00}Новый пароль", "{FFFFFF}Введите новый пароль в поле ниже:", "Низменить", "Отмена");
				SendClientMessage(playerid, COLOR_DARKORANGE, "Длина пароля должна быть от 6 до 15 символов");
				SendClientMessage(playerid, COLOR_DARKORANGE, "Также не допускается использование пробелов");
				return false;
			}
			else
			{
			    static const fmt_str[] = "Ваш новый пароль: {3399FF}%s";
			    new str[sizeof fmt_str + 26 + 15];
				strmid(p_info[playerid][p_password], password, 0, strlen(password), 15);
				OnPlayerChangePassword(p_info[playerid][p_name], "password", p_info[playerid][p_password]);
				SendClientMessage(playerid, -1, "");
				format(str, sizeof(str), fmt_str, inputtext);
				SendClientMessage(playerid, COLOR_YELLOW, str);
				SendClientMessage(playerid, -1, "Рекомендуем сделать скрин {00CC00}(клавиша F8) {FFFFFF}чтобы не забыть его");
				ShowPlayerDialog(playerid, DIALOGUE_SECURITY_SETTINGS, DIALOG_STYLE_LIST, "{FFCD00}Настройки безопасности", "1. Информация о настройках\n2. Мобильный телефон\n3. 'Случайный' PIN-код\n4. Google Authenticator\n{00CC00}5. Изменить пароль\n{FFFFFF}6. Изменить 'случайный' PIN-код\n{0099FF}7. Статус безопасности\n{999999}8. Подтвердить Email", "Выбрать", "Назад");
				return true;
			}
		}
		case DIALOGUE_CHANGE_NAME:
		{
		    if(!response) return true;
		    if(!strlen(inputtext))
      		{
        		SendClientMessage(playerid, COLOR_DARKORANGE, "Недопустимый формат ввода");
      		}
        	for(new i = strlen(inputtext); i != 0; --i)
			switch(inputtext[i])
			{
				case 'А'..'Я', 'а'..'я', ' ':
					return SendClientMessage(playerid, COLOR_DARKORANGE, "Имя уже используется или содержит недопустимые символы"), SendClientMessage(playerid, -1, "Используйте латинские буквы a-z A-Z, а также символы [ ] _");
			}
			if(!GetPVarInt(playerid, "changename"))
			{
				static fmt_str[] = "SELECT * FROM `accounts` WHERE `name` = '%e'";
				new mysql_str[sizeof fmt_str + 44 + MAX_PLAYER_NAME];
    			mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str, inputtext);
				mysql_function_query(database, mysql_str, true, "OnPlayerChangeName", "is", playerid, inputtext);
				return true;
			}
			else
			{
				SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы уже отправили заявку на смену имени!");
			}
		}
		case DIALOGUE_REPORT:
		{
            if(p_info[playerid][p_mute] > 1) return SendClientMessage(playerid, COLOR_DARKORANGE, "Во время бана чата пользоваться репортом нельзя");
		    if(!response) return ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "1. Статистика\n2. Список команд\n3. Личные настройки\n4. Настройки безопасности\n5. Связь с администрацией\n6. Улучшение\n7. Правила сервера\n8. Изменить имя\n9. Дополнительно\n10. ТОП 10 игроков", "Выбрать", "Закрыть");
		    if(!strlen(inputtext))
		    {
		        ShowPlayerDialog(playerid, DIALOGUE_REPORT, DIALOG_STYLE_INPUT, "{FFCD00}Связь с администрацией", "{FFFFFF}Введите своё сообщение для администрации сервера\nОно должно быть кратким и ясным\n\n{66CC66}Если вы хотите подать жалобу на игрока,\nобязательно укажите его ID и причину жалобы", "Отправить", "Назад");
		    }
            static const fmt_str[] = "%s[%d]: {FFCD00}%s";
    		new str[sizeof fmt_str + 15*2 + MAX_PLAYER_NAME*2 + 30*2];
	        format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, (inputtext));
	        SendAdminMessage(0x63cb00FF, str);
	        format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid,(inputtext));
	        SendClientMessage(playerid, 0x63cb00FF, str);
	        SendClientMessage(playerid, -1, "Ваше сообщение отправлено");
	        return true;
		}
		case DIALOGUE_WAREHOUSE:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
		        case 0:
				{
				    if(p_virable[playerid][p_heal] > 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас уже есть аптечки!");
					SendClientMessage(playerid, COLOR_BLUE, "Вы взяли 3 аптечки. Используйте {FFCD00}/healme {319AFF}для использования аптечки");
					p_virable[playerid][p_heal] = 3;
					ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
				}
				case 1:
				{
				    if(p_virable[playerid][p_mask] == 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас уже есть маска!");
					SendClientMessage(playerid, COLOR_BLUE, "Вы взяли маску. Используйте {FFCD00}/mask {319AFF}для скрытия Вашего расположения на карте");
					p_virable[playerid][p_mask] = 1;
					ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
				}
				case 2: ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE+1, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Desert Eagle + M4A1\n2. Desert Eagle + Shotgun\n3. Desert Eagle + AK-47", "Выбрать", "Назад");
		    }
		}
		case DIALOGUE_WAREHOUSE+1:
		{
			if(!response) return ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Аптечкa\n2. Маска\n3. Оружие", "Выбрать", "Закрыть");
		    switch(listitem)
		    {
		        case 0:
				{
					GivePlayerWeapon(playerid, 24, 100), GivePlayerWeapon(playerid, 31, 200);
	                SendClientMessage(playerid, COLOR_BLUE, "Вы взяли Desert Eagle и M4A1");
	                ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE+1, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Desert Eagle + M4A1\n2. Desert Eagle + Shotgun\n3. Desert Eagle + AK-47", "Выбрать", "Назад");
				}
				case 1:
				{
					GivePlayerWeapon(playerid, 24, 100), GivePlayerWeapon(playerid, 25, 200);
	                SendClientMessage(playerid, COLOR_BLUE, "Вы взяли Desert Eagle и Shotgun");
	                ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE+1, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Desert Eagle + M4A1\n2. Desert Eagle + Shotgun\n3. Desert Eagle + AK-47", "Выбрать", "Назад");
				}
				case 2:
				{
					GivePlayerWeapon(playerid, 24, 100), GivePlayerWeapon(playerid, 30, 200);
	                SendClientMessage(playerid, COLOR_BLUE, "Вы взяли Desert Eagle и Shotgun");
	                ShowPlayerDialog(playerid, DIALOGUE_WAREHOUSE+1, DIALOG_STYLE_LIST, "{FFCD00}Склад банды", "1. Desert Eagle + M4A1\n2. Desert Eagle + Shotgun\n3. Desert Eagle + AK-47", "Выбрать", "Назад");
				}
			}
		}
		case DIALOGUE_SERVER_SETTING:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
		        case 0:
		        {
		        	if(anti_sbiv == true)
		        	{
		        	    anti_sbiv = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Анти-сбив анимации выключен");
		        	}
					else
					{
					    anti_sbiv = true;
					    OnServerSettingShow(playerid);
					    SendClientMessage(playerid, 0x66cc00AA, "Анти-сбив анимации включен");
					}
		        }
				case 1:
				{
		        	if(anti_mat == true)
		        	{
		        	    anti_mat = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Анти-мат выключен");
		        	}
					else
					{
					    anti_mat = true;
					    OnServerSettingShow(playerid);
					    SendClientMessage(playerid, 0x66cc00AA, "Анти-мат включен");
					}
				}
		        case 2:
		        {
		        	if(overall_chat == true)
		        	{
		        	    overall_chat = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Общий чат выключен");
		        	}
					else
					{
					    overall_chat = true;
					    OnServerSettingShow(playerid);
					    SendClientMessage(playerid, 0x66cc00AA, "Общий чат включен");
					}
		        }
		        case 3:
		        {
		            if(connect_ip_show == true)
		            {
		        	    connect_ip_show = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Информация о подключении выключена");
		            }
		            else
		            {
		        	    connect_ip_show = true;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0x66cc00AA, "Информация о подключении включена");
		            }
		        }
		        case 4:
		        {
		            if(capture_on_off == true)
		            {
		        	    capture_on_off = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Разрешение на капт выключен");
		            }
		            else
		            {
		        	    capture_on_off = true;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0x66cc00AA, "Разрешение на капт включен");
		            }
		        }
		        case 5:
		        {
		            if(set_score == true)
		            {
		        	    set_score = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Разрешение на выдачу убийств выключено");
		            }
		            else
		            {
		        	    set_score = true;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0x66cc00AA, "Разрешение на выдачу убийств включено");
		            }
		        }
		        case 6:
		        {
		            if(anti_spawnkill == true)
		            {
		        	    anti_spawnkill = false;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0xbd0606AA, "Анти-СК выключено");
		            }
		            else
		            {
		        	    anti_spawnkill = true;
		        	    OnServerSettingShow(playerid);
		        	    SendClientMessage(playerid, 0x66cc00AA, "Анти-СК включено");
		            }
		        }
		    }
		}
  		case DIALOGUE_TELEPORT_EVENT:
        {
            if(!response) return true;
            SetPlayerPos(playerid, GetPVarFloat(playerid, "position_event_x"), GetPVarFloat(playerid, "position_event_y"), GetPVarFloat(playerid, "position_event_z"));
            SetPlayerVirtualWorld(playerid, GetPVarInt(playerid, "virtualworld_event")), SetPlayerInterior(playerid, GetPVarInt(playerid, "interior_event"));
			DeletePVar(playerid, "position_event_x"), DeletePVar(playerid, "position_event_y"), DeletePVar(playerid, "position_event_z"), DeletePVar(playerid, "virtualworld_event"), DeletePVar(playerid, "interior_event");
            return true;
        }
		case DIALOGUE_CHANGE_SKIN_GROVE:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
				case 0:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 86);
				}
				case 1:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 105);
				}
				case 2:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 106);
				}
				case 3:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 107);
				}
				case 4:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 149);
				}
				case 5:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 195);
				}
				case 6:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 269);
				}
				case 7:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 270);
				}
				case 8:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 271);
				}
		    }
		}
		case DIALOGUE_CHANGE_SKIN_BALLAS:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
				case 0:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 102);
				}
				case 1:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 103);
				}
				case 2:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 104);
				}
				case 3:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 195);
				}
		    }
		}
		case DIALOGUE_CHANGE_SKIN_VAGOS:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
				case 0:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 108);
				}
				case 1:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 109);
				}
				case 2:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 110);
				}
				case 3:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 190);
				}
		    }
		}
		case DIALOGUE_CHANGE_SKIN_AZTEC:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
				case 0:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 114);
				}
				case 1:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 115);
				}
				case 2:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 116);
				}
				case 3:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 292);
				}
				case 4:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 193);
				}
		    }
		}
		case DIALOGUE_CHANGE_SKIN_RIFA:
		{
		    if(!response) return true;
		    switch(listitem)
		    {
				case 0:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 173);
				}
				case 1:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 174);
				}
				case 2:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 175);
				}
				case 3:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 273);
				}
				case 4:
				{
				    static const
				        fmt_str0[] = "Ваша внешность была изменена лидером организации %s[%d]",
				        fmt_str1[] = "Вы изменили внешность игрока %s[%d]";
				    new str[sizeof fmt_str0 + 87 + MAX_PLAYER_NAME*2];
				    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
				    format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
				    SendClientMessage(playerid, COLOR_BLUE, str);
					SetPlayerSkin(playerid, 226);
				}
		    }
		}
		case DIALOGUE_RADIO:
		{
			if(!response) return true;
			switch(listitem)
			{
				case 0:
				{
					PlayAudioStreamForPlayer(playerid, "http://ссылка_на_ваше_радио.com/ганг_зона_ини");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 1:
				{
					PlayAudioStreamForPlayer(playerid, "http://online-radiomelodia.tavrmedia.ua/RadioMelodia.m3u");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 2:
				{
					PlayAudioStreamForPlayer(playerid, "http://kissfm.ua/v3/kiss-2.m3u");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 3:
				{
					PlayAudioStreamForPlayer(playerid, "http://radio02-cn03.akadostream.ru:8108/shanson128.mp3");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 4:
				{
					PlayAudioStreamForPlayer(playerid, "http://online.radiorecord.ru:8101/rr_128");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 5:
				{
					PlayAudioStreamForPlayer(playerid, "http://stream05.akaver.com/skyradio_hi.mp3");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 6:
				{
					PlayAudioStreamForPlayer(playerid, "http://striiming.trio.ee/dfm64.mp3.m3u");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
				case 7:
				{
					PlayAudioStreamForPlayer(playerid, "http://skycast.su:2007/rock-online.m3u");
					SetPVarInt(playerid, "radio_enabled", true);
					SendClientMessage(playerid, 0x00cc00AA, "Онлайн радио включено");
				}
			}
		}
		case DIALOGUE_STATISTIC:
	    {
	        if(!response) return true;
	        else ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "1. Статистика\n2. Список команд\n3. Личные настройки\n4. Настройки безопасности\n5. Связь с администрацией\n6. Улучшение\n7. Правила сервера\n8. Изменить имя\n9. Дополнительно\n10. ТОП 10 игроков", "Выбрать", "Закрыть");
	    }
	    case DIALOGUE_RULES:
	    {
	        if(!response) ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "1. Статистика\n2. Список команд\n3. Личные настройки\n4. Настройки безопасности\n5. Связь с администрацией\n6. Улучшение\n7. Правила сервера\n8. Изменить имя\n9. Дополнительно\n10. ТОП 10 игроков", "Выбрать", "Закрыть");
	        else ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "1. Статистика\n2. Список команд\n3. Личные настройки\n4. Настройки безопасности\n5. Связь с администрацией\n6. Улучшение\n7. Правила сервера\n8. Изменить имя\n9. Дополнительно\n10. ТОП 10 игроков", "Выбрать", "Закрыть");
	    }
	}
	return true;
}

public OnPlayerKeyStateChange(playerid, newkeys, oldkeys)
{
	if(anti_spawnkill == true)
	{
	    if((newkeys & KEY_FIRE) || ((newkeys & 128) && (oldkeys & 128) && (newkeys & KEY_SECONDARY_ATTACK)))
	    {
	        if((PlayerToPoint(25.0, playerid, 2510.8179,-1688.1503,13.5579)) && p_virable[playerid][p_gang] != 1 && !IsPlayerInAnyVehicle(playerid))
	        {
				ApplyAnimation(playerid, "PED", "KO_SKID_BACK",4.1,0,0,0,0,0);
				SetTimerEx("@_AntiSpawnKill", 600, 0, "d", playerid);
	        }
	        if((PlayerToPoint(38.0, playerid,2023.2432,-1126.6998,24.8604)) && p_virable[playerid][p_gang] != 2 && !IsPlayerInAnyVehicle(playerid))
	        {
				ApplyAnimation(playerid, "PED", "KO_SKID_BACK",4.1,0,0,0,0,0);
				SetTimerEx("@_AntiSpawnKill", 600, 0, "d", playerid);
	        }
	        if((PlayerToPoint(25.0, playerid, 2745.7488,-1176.1808,69.4028)) && p_virable[playerid][p_gang] != 3 && !IsPlayerInAnyVehicle(playerid))
	        {
				ApplyAnimation(playerid, "PED", "KO_SKID_BACK",4.1,0,0,0,0,0);
				SetTimerEx("@_AntiSpawnKill", 600, 0, "d", playerid);
	        }
	        if((PlayerToPoint(50.0, playerid, 2187.7395,-1792.3521,14.3080)) && p_virable[playerid][p_gang] != 4 && !IsPlayerInAnyVehicle(playerid))
	        {
				ApplyAnimation(playerid, "PED", "KO_SKID_BACK",4.1,0,0,0,0,0);
				SetTimerEx("@_AntiSpawnKill", 600, 0, "d", playerid);
	        }
	        if((PlayerToPoint(38.0, playerid, 2782.1072,-1925.2031,13.5469)) && p_virable[playerid][p_gang] != 5 && !IsPlayerInAnyVehicle(playerid))
	        {
				ApplyAnimation(playerid, "PED", "KO_SKID_BACK",4.1,0,0,0,0,0);
				SetTimerEx("@_AntiSpawnKill", 600, 0, "d", playerid);
	        }
	        return true;
	    }
	}
   	return true;
}

public OnPlayerSelectedMenuRow(playerid, row)
{
	if(GetPlayerMenu(playerid) == spectrate_menu)
	{
	    switch(row)
        {
			case 0:
			{
			    TogglePlayerSpectating(playerid, false);
			    HideMenuForPlayer(spectrate_menu, playerid);
				SetPlayerPos(playerid, GetPVarFloat(playerid, "position_spectrate_x"), GetPVarFloat(playerid, "position_spectrate_y"), GetPVarFloat(playerid, "position_spectrate_z"));
            	SetPlayerVirtualWorld(playerid, GetPVarInt(playerid, "virtualworld_spectrate")), SetPlayerInterior(playerid, GetPVarInt(playerid, "interior_spectrate"));
				DeletePVar(playerid, "position_spectrate_x"), DeletePVar(playerid, "position_spectrate_y"), DeletePVar(playerid, "position_spectrate_z"), DeletePVar(playerid, "virtualworld_spectrate"), DeletePVar(playerid, "interior_spectrate"), DeletePVar(playerid, "spectrate_id");
			}
			case 1:
			{
			    if(p_info[playerid][p_admin] < 3) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вам не доступна данная функция.");
				new
					cmd_str[46 + MAX_PLAYER_NAME*2];
				format(cmd_str, sizeof(cmd_str), "%d", GetPVarInt(playerid, "spectrate_id"));
				cmd::skick(playerid, cmd_str);
				ShowMenuForPlayer(spectrate_menu, playerid);
			}
			case 2:
			{
	   		    new
				   	Float: position[3];
				GetPlayerPos(GetPVarInt(playerid, "spectrate_id"), position[0], position[1], position[2]);
				SetPlayerPos(GetPVarInt(playerid, "spectrate_id"), position[0], position[1], position[2] + 5);
				ShowMenuForPlayer(spectrate_menu, playerid);
			}
			case 3:
			{
			    if(p_info[playerid][p_admin] < 4) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вам не доступна данная функция.");
				new
					cmd_str[11];
				format(cmd_str, sizeof(cmd_str), "%d", GetPVarInt(playerid, "spectrate_id"));
				cmd::gm(playerid, cmd_str);
				ShowMenuForPlayer(spectrate_menu, playerid);
			}
			case 4:
			{
			    if(p_info[playerid][p_admin] < 1) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вам не доступна данная функция.");
			    static const fmt_str[] = "[A] Ник: %s [ID: %i] [IP: %s] [PING: %i]";
			    new str[sizeof fmt_str + 36 + MAX_PLAYER_NAME + 16 + 11];
				format(str, sizeof(str), fmt_str, p_info[GetPVarInt(playerid, "spectrate_id")][p_name], GetPVarInt(playerid, "spectrate_id"), p_ip[GetPVarInt(playerid, "spectrate_id")], GetPlayerPing(GetPVarInt(playerid, "spectrate_id")));
				SendClientMessage(playerid, 0x33CCFFAA, str);
				ShowMenuForPlayer(spectrate_menu, playerid);
			}
			case 5:
			{
			    if(p_info[playerid][p_admin] < 1) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вам не доступна данная функция.");
				new
					cmd_str[11];
				format(cmd_str, sizeof(cmd_str), "%d", GetPVarInt(playerid, "spectrate_id"));
				cmd::stats(playerid, cmd_str);
				ShowMenuForPlayer(spectrate_menu, playerid);
			}
			case 6:
			{
			    if(p_info[playerid][p_admin] < 1) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вам не доступна данная функция.");
			    new
					cmd_str[11];
				GameTextForPlayer(playerid, "~w~SPEC ~g~UPDATED", 1000, 3);
				format(cmd_str, sizeof(cmd_str), "%d", GetPVarInt(playerid, "spectrate_id"));
				cmd::sp(playerid, cmd_str);
				ShowMenuForPlayer(spectrate_menu, playerid);
			}
			case 7:
			{
			    TogglePlayerSpectating(playerid, false);
			    HideMenuForPlayer(spectrate_menu, playerid);
				SetPlayerPos(playerid, GetPVarFloat(playerid, "position_spectrate_x"), GetPVarFloat(playerid, "position_spectrate_y"), GetPVarFloat(playerid, "position_spectrate_z"));
            	SetPlayerVirtualWorld(playerid, GetPVarInt(playerid, "virtualworld_spectrate")), SetPlayerInterior(playerid, GetPVarInt(playerid, "interior_spectrate"));
				DeletePVar(playerid, "position_spectrate_x"), DeletePVar(playerid, "position_spectrate_y"), DeletePVar(playerid, "position_spectrate_z"), DeletePVar(playerid, "virtualworld_spectrate"), DeletePVar(playerid, "interior_spectrate"), DeletePVar(playerid, "spectrate_id");
			}
		}
	}
	return true;
}

public OnPlayerClickMap(playerid, Float: fX, Float: fY, Float: fZ)
{
    if(p_info[playerid][p_admin] < 4) return true;
    SetPlayerPos(playerid, fX, fY, fZ);
    return true;
}

public OnPlayerGiveDamage(playerid, damagedid, Float: amount, weaponid, bodypart)
{
    return true;
}

public OnPlayerCommandReceived(playerid, cmdtext[])
{
    if(!GetPVarInt(playerid, "logged")) return false;
    return true;
}

public OnPlayerAccountCheck(playerid)
{
    new
		rows, fields;
	SetPlayerCameraPos(playerid, 1678.2035, -1481.4669, 110.1527);
	SetPlayerCameraLookAt(playerid, 1614.6501, -1576.7792, 88.1527);
    cache_get_data(rows, fields);
    if(!rows)
    {
        ShowPlayerDialog(playerid, DIALOGUE_REGISTRATION, DIALOG_STYLE_INPUT, "{66CCFF}Регистрация", "{FFFFFF}Добро пожаловать на сервер "SERVER_NAME"\nЧтобы начать игру вам необходимо пройти регистрацию\n\nВведите пароль для Вашего аккаунта\nОн будет запрашиваться каждый раз, когда вы заходите на сервер\n\n{66CC33}\tПримечания:\n\t- Пароль может состоять из русских и латинских символов\n\t- Пароль чувствителен к регистру\n\t- Длина пароля от 6-ти до 15-ти символов", "Далее", "");
    }
    else
    {
		static const fmt_str[] = "{FFFFFF}Добро пожаловать на сервер "SERVER_NAME"\nВаш ник зарегистрирован\n\nЛогин: {66CC33}%s\n{FFFFFF}Введите пароль:";
		new str[sizeof fmt_str + 115 + MAX_PLAYER_NAME];
		format(str, sizeof(str), fmt_str, p_info[playerid][p_name]);
		ShowPlayerDialog(playerid, DIALOGUE_AUTHORIZATION, DIALOG_STYLE_INPUT, "{66CCFF}Авторизация", str, "Войти", "Отмена");
        cache_get_field_content(0, "password", p_info[playerid][p_password], database, 15);
        authorization{playerid} = 30;
    }
    return true;
}

public OnPlayerAccountLoad(playerid)
{
	static fmt_str[] = "SELECT * FROM `accounts_ban` WHERE `player` = '%e' LIMIT 1";
	new str[sizeof fmt_str + 555];
    p_info[playerid][p_id] = cache_get_field_content_int(0, "id", database);
	cache_get_field_content(0, "registration_ip", p_info[playerid][p_rip], database, 16);
	cache_get_field_content(0, "last_ip", p_info[playerid][p_lip], database, 16);
    cache_get_field_content(0, "registration_data", p_info[playerid][p_rdata], database, 32);
	p_info[playerid][p_kills] = cache_get_field_content_int(0, "kills", database);
	p_info[playerid][p_deaths] = cache_get_field_content_int(0, "deaths", database);
	p_info[playerid][p_admin] = cache_get_field_content_int(0, "admin", database);
	p_info[playerid][p_vip] = cache_get_field_content_int(0, "vip", database);
	p_info[playerid][p_donat] = cache_get_field_content_int(0, "donat", database);
	p_info[playerid][p_all_donat] = cache_get_field_content_int(0, "all_donat", database);
    p_info[playerid][p_jail] = cache_get_field_content_int(0, "jail", database);
    p_info[playerid][p_mute] = cache_get_field_content_int(0, "mute", database);
    p_info[playerid][p_chat_standard] = cache_get_field_content_int(0, "standart_chat", database);
    p_info[playerid][p_chat_organization] = cache_get_field_content_int(0, "fraction_chat", database);
    p_info[playerid][p_nick_in_chat] = cache_get_field_content_int(0, "nick_in_chat", database);
    p_info[playerid][p_nick_over_player] = cache_get_field_content_int(0, "nick_over_player", database);
    p_info[playerid][p_id_in_chat] = cache_get_field_content_int(0, "id_in_chat", database);
    p_info[playerid][p_in_game] = cache_get_field_content_int(0, "in_game", database);

    authorization{playerid} = 0;

    mysql_format(database, str, sizeof(str), fmt_str, p_info[playerid][p_name]);
    mysql_function_query(database, str, true, "OnPlayerAccountCheckBan", "d", playerid);
    return true;
}

public OnPlayerAccountCheckAdmin(playerid, player_name[])
{
	new
		rows, fields;
    cache_get_data(rows, fields);
    if(!rows)
    {
        SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого аккаунта нет!");
    }
	else
	{
	    new
	        account_id, kills, deaths, rip[16], lip[16], rdata[16], donat;
		account_id = cache_get_field_content_int(0, "id"),
 		kills = cache_get_field_content_int(0, "kills"),
  		deaths = cache_get_field_content_int(0, "deaths"),
		cache_get_field_content(0, "registration_ip", rip, 16),
		cache_get_field_content(0, "last_ip", lip, 16),
		cache_get_field_content(0, "registration_data", rdata, 16),
  		donat = cache_get_field_content_int(0, "donat");
        static const fmt_str[] = "Номер аккаунта:\t\t%d\nУбийств:\t\t\t%d\nСмертей:\t\t\t%d\nIP адресс (регис.):\t%s\nIP адресс (послед.):\t%s\nДата регистрации:\t%s\nДонат:\t\t\t%d";
        new str[sizeof fmt_str + 700];
        format(str, sizeof(str), fmt_str, account_id, kills, deaths, rip, lip, rdata, donat);
        ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, player_name, str, "Закрыть", "");
	}
	return true;
}

public OnPlayerChangePassword(name[], base[], pass[])
{
	static fmt_str[] = "UPDATE `accounts` SET  %s = '%e' WHERE `name` = '%e' LIMIT 1";
	new mysql_str[sizeof fmt_str + 59 + MAX_PLAYER_NAME + 15];
	mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str, base, pass, name);
	mysql_function_query(database, mysql_str, false, "", "");
	return true;
}

public OnPlayerChangeName(playerid, inputtext[])
{
    new
	    rows, fields;
    cache_get_data(rows, fields);
	if(rows)
	{
	    SendClientMessage(playerid, COLOR_DARKORANGE, "Вы уже используете это имя");
	}
    else
    {
        static const fmt_str[] = "[Смена имени]: %s >> %s {66CC00}| /okay %d для одобрения";
        new str[sizeof fmt_str + 55 + MAX_PLAYER_NAME*2];
    	ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "Заявка на изменение имени", "\
		{FFFFFF}Ваша просьба об изменении ника отправлена администрации.\n\
		Вы получите сообщение, как только заявка будет обработана\n\n\
		Если в течении нескольких минут Ваше имя не было изменено,\n\
		то, скорее всего, оно не соответствует правилам.", "Ок", "");
        SetPVarInt(playerid, "changename", 1),
		SetPVarString(playerid, "changename_str", inputtext);
        format(str, sizeof(str), fmt_str, p_info[playerid][p_name], inputtext, playerid);
        SendAdminMessage(0xBDB76BAA, str);
    }
    return true;
}

public OnGZLoad()
{
    new
	    fields,
	    time = GetTickCount();
    cache_get_data(total_gangzone, fields);
    if(!total_gangzone) return print("[MYSQL_LOG]: Таблица `gangzone` пустая");
    for(new i = 0; i != sizeof(gz_info); i++)
    {
        gz_info[i][gz_coords][0] = cache_get_field_content_float(i, "X", database);
        gz_info[i][gz_coords][1] = cache_get_field_content_float(i, "Y", database);
        gz_info[i][gz_coords][2] = cache_get_field_content_float(i, "XX", database);
        gz_info[i][gz_coords][3] = cache_get_field_content_float(i , "YY", database);
        gz_info[i][gz_gang] = cache_get_field_content_int(i, "member", database);
        switch(gz_info[i][gz_gang])
        {
            case 1: gangzone[0]++;
            case 2: gangzone[1]++;
            case 3: gangzone[2]++;
            case 4: gangzone[3]++;
            case 5: gangzone[4]++;
        }
        gz_info[i][gz_id] = GangZoneCreate(gz_info[i][gz_coords][0], gz_info[i][gz_coords][1], gz_info[i][gz_coords][2], gz_info[i][gz_coords][3]);
    }
    return printf("\n- Гангзон закружено: %d. За: (%d ms)", total_gangzone, GetTickCount() - time);
}

public OnGZSave(i)
{
    static const fmt_str[] = "UPDATE `gangzone` SET `X`='%f', `Y`='%f', `XX`='%f', `YY`='%f', `member`='%d' WHERE `id`='%d'";
    new mysql_str[sizeof fmt_str + 150];
    format(mysql_str, sizeof(mysql_str), fmt_str, gz_info[i][gz_coords][0], gz_info[i][gz_coords][1], gz_info[i][gz_coords][2], gz_info[i][gz_coords][3], gz_info[i][gz_gang], i);
    mysql_function_query(database, mysql_str, false, "", "");
    return true;
}

public OnPlayerTop(playerid)
{
    new
        string[256], str[(12*10)+(2*10)+(11*10)+(MAX_PLAYER_NAME*10)],
		r[2], nick[MAX_PLAYER_NAME];
    cache_get_data(r[0], r[1]);
    if(r[0])
    {
        string = "Место\t\tУбийств\t\tНик\n\n";
	    for(new i = 0; i < r[0]; i++)
        {
            cache_get_field_content(i, "name", nick, database, MAX_PLAYER_NAME);
            format(str, sizeof str, "{FFFFFF}%d\t\t%d\t\t%s\n", i+1, cache_get_field_content_int(i, "kills", database), nick);
            strcat(string, str);
        }
        ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "{FFCD00}Топ 10 игроков", string, "Ок", "");
    }
    return true;
}

public OnSquared(playerid,Float:min_x,Float:min_y,Float:max_x,Float:max_y)
{
    new
		Float: position[3];
    GetPlayerPos(playerid, position[0], position[1], position[2]);
    if((position[0] <= max_x && position[0] >= min_x) && (position[1] <= max_y && position[1] >= min_y)) return true;
    return false;
}

public SendAdminMessage(color, string[])
{
	foreach(new i: Player)
	{
		if(!p_info[i][p_admin]) continue;
		SendClientMessage(i, color, string);
	}
}

public SendGhettoMessage(family, color, string[])
{
    foreach(new i: Player)
    {
        if(p_virable[i][p_gang] != family) continue;
        SendClientMessage(i, color, string);
    }
}

public SendVIPMessage(color, string[])
{
	foreach(new i: Player)
	{
		if(!p_info[i][p_vip]) continue;
		SendClientMessage(i, color, string);
	}
}

public OnPlayerSbivAnimation(playerid, pos_x, pos_y, pos_z)
{
    new
		Float: position[3];
    GetPlayerPos(playerid, position[0], position[1], position[2]);
    if(position[0] && position[1] && position[2] != pos_x && pos_y && pos_z)
    {
        static const fmt_str[] = "[Aнти-сбив] %s[%d] попал в тюрьму. Причина: Сбив анимации.";
        new str[sizeof fmt_str + 58 + MAX_PLAYER_NAME];
		format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid);
		SendClientMessageToAll(COLOR_RED, str);
        p_info[playerid][p_jail] = 5*60;
		SetPlayerHealth(playerid, 0);
    }
    return true;
}

public OnPlayerGodModTest(playerid, for_playerid, Float: healt_before_explosion)
{
	static const
		fmt_str0[] = "До:\t\t\t%.0f%%\nПосле:\t\t\t%.0f%%\nHP уменьшилось на:\t%.0f%%\n\n{00CC00}ГМ не обноружено. HP игрока восстановлено",
		fmt_str1[] = "До:\t\t\t%.0f%%\nПосле:\t\t\t%.0f%%\nHP не уменьшилось\n\n{FF6347}Возможно этот игрок использует ГМ";
	new str[sizeof fmt_str0 + 555]; //edit string
    new Float: healt_after_explosion, Float: changing_health;
    GetPlayerHealth(playerid, healt_after_explosion);
    changing_health = healt_before_explosion - healt_after_explosion;
	if(changing_health > 0.0)
	{
	    format(str, sizeof(str), fmt_str0, healt_before_explosion, healt_after_explosion, changing_health);
	}
	else
	{
		format(str, sizeof(str), fmt_str1, healt_before_explosion, healt_after_explosion);
	}
	ShowPlayerDialog(for_playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, p_info[playerid][p_name], str, "Закрыть", "");
	health_godmod_test = healt_before_explosion;
	SetPlayerHealth(playerid, healt_before_explosion);
	return true;
}

public OnPlayerUnban(playerid, nick[])
{
	static const
	    fmt_str0[] = "DELETE FROM `accounts_ban` WHERE `player` = '%s'",
	    fmt_str1[] = "[A] %s[%d] разбанил игрока %s.";
	new
	    str0[sizeof fmt_str0 + 555],
	    str1[sizeof fmt_str1 + 26 + MAX_PLAYER_NAME*2],
		rows, fields;
    cache_get_data(rows, fields);
    if(!rows) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Аккаунт не забанен!");
    format(str0, sizeof(str0), fmt_str0, nick);
    mysql_function_query(database, str0, false, "", "");
    format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], playerid, nick);
    SendAdminMessage(COLOR_RED, str1);
    return true;
}

public OnPlayerAccountCheckBan(playerid)
{
	static const fmt_str0[] = "{FFFFFF}Этот аккаунт заблокирован на {FF4400}%s дней.\n\n{FFFFFF}Ник администратора: %s\nПричина блокировки: %s\nДата и время: %s\n\nВведите {FFCD00}/q (/quit){FFFFFF} чтобы выйти.";
	static fmt_str1[] = "DELETE FROM `accounts_ban` WHERE `player` = '%s'";
	new
	    str0[sizeof fmt_str0 + 555],
	    str1[sizeof fmt_str1 + 555],
		rows, fields, ban_data[50], unban_data, admin[MAX_PLAYER_NAME], reason[128];
    cache_get_data(rows, fields);
    if(!rows)
    {
        new
            str[17+MAX_PLAYER_NAME];
        format(str, sizeof(str), "~w~Welcome ~n~~b~%s", p_info[playerid][p_name]);
		GameTextForPlayer(playerid, str, 5000, 1);
					
	    SetPVarInt(playerid, "logged", 1);

		if(p_info[playerid][p_nick_over_player] == 2) return ShowNameTags(0);

		if(p_info[playerid][p_admin] > 0)
		{
			switch(p_info[playerid][p_admin])
			{
				case 1: SendClientMessage(playerid, COLOR_YELLOW, "Вы вошли как администратор первого уровня");
				case 2: SendClientMessage(playerid, COLOR_YELLOW, "Вы вошли как администратор второго уровня");
				case 3: SendClientMessage(playerid, COLOR_YELLOW, "Вы вошли как администратор третьего уровня");
				case 4: SendClientMessage(playerid, COLOR_YELLOW, "Вы вошли как администратор четвертого уровня");
				default: SendClientMessage(playerid, COLOR_YELLOW, "Вы вошли как главный администратор");
			}
		}
		ShowPlayerDialog(playerid, DIALOGUE_CHOICE_GANG, DIALOG_STYLE_LIST, "{66CCFF}Выберите банду", "1. Grove Street\n2. The Ballas\n3. Los Santos Vagos\n4. Varios Los Aztecas\n5. The Rifa", "Выбрать", "Выйти");
		for(new i; i < 11 ; i++) TextDrawShowForPlayer(playerid, monitoring_TD[i]);
    }
    unban_data = cache_get_field_content_int(0, "unban_data");
    cache_get_field_content(0, "admin", admin);
    cache_get_field_content(0, "reason", reason);
    cache_get_field_content(0, "ban_data", ban_data);
    if(unban_data > gettime())
    {
    	format(str0, sizeof(str0), fmt_str0, date("%dd", unban_data), admin, reason, ban_data);
     	ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "{3399FF}Advance RolePlay", str0, "Закрыть", "");
      	KickEx(playerid);
       	return true;
    }
	else
	{
	    mysql_format(database, str1, sizeof(str1), fmt_str1, p_info[playerid][p_name]);
        mysql_function_query(database, str1, false, "", "");
	}
    return true;
}

public OnServerRestarting()
{
	foreach(new i: Player)
	{
		SetPlayerInterior(i, 0);
		SetPlayerVirtualWorld(i, 0);
		InterpolateCameraPos(i, 1178.088012, 1204.779541, 105.671997, 2501.051269, 1285.838867, 118.900398, 5000);
		InterpolateCameraLookAt(i, 1175.603149, 1201.194458, 103.228073, 2496.586669, 1285.855346, 116.649597, 5000);
	}
	GameTextForAll("~r~RE~g~STARTING", 15000, 0);
	SendClientMessageToAll(0x00CC00AA, "Происходит автоматическая перезагрузка сервера...");
	SetTimer("restart", 15000, false);
	return true;
}

public OnPlayerAccountAdminCheck(playerid)
{
    new
		rows, fields;
    cache_get_data(rows, fields);
    if(rows)
    {
        static
			fmt_str0[] = "DELETE FROM `accounts_adm` WHERE `name` = '%s'",
			fmt_str1[] = "UPDATE accounts SET `admin` = '%s' WHERE `name` = '%s'";
		new
			str0[sizeof fmt_str0 + 555],//edit string
			str1[sizeof fmt_str1 + 555];//edit string
		p_info[playerid][p_admin] = cache_get_field_content_int(0, "level", database);
        SendClientMessage(playerid, COLOR_YELLOW, "Ваш уровень администратора был изменён");
	    mysql_format(database, str0, sizeof(str0), fmt_str0, p_info[playerid][p_name]);
        mysql_function_query(database, str0, false, "", "");
		mysql_format(database, str1, sizeof(str1), fmt_str1, p_info[playerid][p_admin], p_info[playerid][p_name]);
	 	mysql_tquery(database, str1, "", "");
    }
    return true;
}

public OnPlayerKick(playerid)
{
    if(IsPlayerConnected(playerid))
	{
		DeletePVar(playerid, "kicked");
	 	Kick(playerid);
	}
}

stock KickEx(playerid)
{
    if(GetPVarInt(playerid, "kicked")) return true;
    SetTimerEx("OnPlayerKick", 1000, false, "d", playerid);
    SetPVarInt(playerid, "kicked", 1);
    return true;
}

stock OnPlayerAccountCreate(playerid, password[])
{
    static const fmt_str[] = "INSERT INTO `accounts` (`name`, `password`, `registration_ip`, `registration_data`) VALUES ('%s', '%s', '%s', '%s')";
    new
		mysql_str[sizeof fmt_str + 150],
		data[50], day, month, year;
	getdate(year, month, day);
    format(data, 50, "%04d-%02d-%02d", year, month, day);
    format(mysql_str, sizeof(mysql_str), fmt_str, p_info[playerid][p_name], password, p_ip[playerid], data);
    //mysql_function_query(database, mysql_str, false, "", "");
    mysql_function_query(database, mysql_str, true, "OnPlayerAccountLoad", "i", playerid);
    SetPVarInt(playerid, "logged", 1);
    ShowPlayerDialog(playerid, DIALOGUE_CHOICE_GANG, DIALOG_STYLE_LIST, "{66CCFF}Выберите банду", "1. Grove Street\n2. The Ballas\n3. Los Santos Vagos\n4. Varios Los Aztecas\n5. The Rifa", "Выбрать", "Выйти");
    for(new i; i < 11 ; i++) TextDrawShowForPlayer(playerid, monitoring_TD[i]);
    return true;
}

stock ExtraSaveAccount()
{
    foreach(new i : Player)
	{
	    print("- Произошёл рестарт сервера! Все аккаунт сохранены!");
		OnPlayerAccountSave(i);
	}
	return true;
}

stock OnPlayerAccountSave(playerid)
{
    if(GetPVarInt(playerid, "logged") == 1)
	{
		static fmt_str[] = "UPDATE accounts SET `kills` = '%d', `deaths` = '%d', `jail` = '%d', `mute` = '%d', `last_ip` = '%s', `in_game` = '%i' WHERE `name` = '%e'  LIMIT 1";
		new mysql_str[sizeof fmt_str + 555];//edit string
		mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str, p_info[playerid][p_kills], p_info[playerid][p_deaths], p_info[playerid][p_jail], p_info[playerid][p_mute], p_ip[playerid], p_info[playerid][p_in_game], p_info[playerid][p_name]);
	    mysql_tquery(database, mysql_str, "", "");
	}
	return true;
}

stock OnPlayerAccountSettingSave(playerid)
{
    if(GetPVarInt(playerid, "logged") == 1)
	{
		static fmt_str[] = "UPDATE accounts SET `standart_chat` = '%d', `fraction_chat` = '%d', `nick_in_chat` = '%d', `nick_over_player` = '%d', `id_in_chat` = '%d'  WHERE `name` = '%e'  LIMIT 1";
		new mysql_str[sizeof fmt_str + 165 + 10 + MAX_PLAYER_NAME];
	 	mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str, p_info[playerid][p_chat_standard], p_info[playerid][p_chat_organization], p_info[playerid][p_nick_in_chat], p_info[playerid][p_nick_over_player], p_info[playerid][p_id_in_chat], p_info[playerid][p_name]);
	    mysql_tquery(database, mysql_str, "", "");
	}
	return true;
}

stock OnPlayerRemoveInfo(playerid)
{
    p_info[playerid][p_id] = 0;
    p_info[playerid][p_name][0] = EOS;
    p_info[playerid][p_password][0] = EOS;
    p_info[playerid][p_rip] = EOS;
    p_info[playerid][p_lip] = EOS;
    p_info[playerid][p_rdata] = EOS;
    p_info[playerid][p_admin] = 0;
    p_info[playerid][p_vip] = 0;
    p_info[playerid][p_kills] = 0;
    p_info[playerid][p_deaths] = 0;
    p_info[playerid][p_mute] = 0;
    p_info[playerid][p_jail] = 0;
    p_info[playerid][p_donat] = 0;
    p_info[playerid][p_all_donat] = 0;
    p_info[playerid][p_chat_standard] = 1;
    p_info[playerid][p_chat_organization] = 1;
    p_info[playerid][p_nick_in_chat] = 1;
	p_info[playerid][p_nick_over_player] = 1;
 	p_info[playerid][p_id_in_chat] = 1;
 	p_info[playerid][p_in_game] = 0;
 	p_info[playerid][p_in_game_second] = 0;
    p_virable[playerid][p_gang] = 0;
    p_virable[playerid][p_heal] = 0;
    p_virable[playerid][p_mask] = 0;
    afk_time{playerid} = 0;

    return true;
}

@__OnEverySecondTimer();
@__OnEverySecondTimer()
{
    new
		hour, minute, second;
	gettime(hour, minute, second);
	if(minute == 0)
	{
		if(pay_day == true)
		{
			PayDay();
			pay_day = false;
		}
	}
	if(hour == 5 && minute == 3 && second == 0)
	{
		SendClientMessageToAll(COLOR_YELLOW, "Через две минуты произойдет автоматическая перезагрузка сервера.");
		SendClientMessageToAll(COLOR_YELLOW, "Закончите пожалуйста все свои работы!");
		SetTimer("OnServerRestarting", 120000, false);
	}
	foreach(new i: Player)
	{
	    p_info[i][p_in_game_second] += 1;
		if(p_info[i][p_in_game_second] >= 60)
		{
			p_info[i][p_in_game] += 1;
			p_info[i][p_in_game_second] = 0;
		}
		
		if(p_info[i][p_jail] > 0 && afk_time{i} == 0)
	    {
	        p_info[i][p_jail]--;
	        if(p_info[i][p_jail] == 0)
	        {
	            SendClientMessage(i, COLOR_YELLOW, "Вы отбыли свой срок и можете идти на свободу");
	            SetPlayerVirtualWorld(i, 0);
	            SpawnPlayer(i);
	        }
	    }
	    if(p_info[i][p_mute] > 0 && afk_time{i} == 0)
	    {
	        p_info[i][p_mute]--;
	        if(p_info[i][p_mute] == 0)
	        {
	            SendClientMessage(i, 0x66cc00AA, "Мут снят");//Изменить текст
	        }
	    }
	    if(authorization{i} != 0 && -- authorization{i} == 0)
		{
			SendClientMessage(i, COLOR_DARKORANGE, "Время на авторизацию ограничено");
			SendClientMessage(i, COLOR_DARKORANGE, "Введите /q (/quit) чтобы выйти");
            Kick(i);
        }
	    afk_time{i} ++;
	    if(afk_time{i} >= 3 && GetPVarInt(i, "logged"))
		{
			SetPVarInt(i, "player_afk_use", 1);
			static const fmt_str[] = "На паузе %s";
		   	new str[sizeof fmt_str + 15];
	    	format(str, sizeof(str), fmt_str, converts_time(afk_time{i}));
	    	SetPlayerChatBubble(i, str, 0xFF0000AA, 10.0, 1000);
		}
	}
	OnMonitoringTimer();
	OnCaptureTimer();
	return true;
}

@__AntiSpawnKill(playerid);
@__AntiSpawnKill(playerid)
{
	ApplyAnimation(playerid, "PED", "getup_front", 5.0, 0, 0, 0, 0, 0);
}

stock PayDay()
{
	new
		hours;
	gettime(hours);
	pay_day = false;
	static const fmt_str0[] = "Текущее время: {0099FF}%d:00";
 	new str0[sizeof fmt_str0 + 28];
	format(str0, sizeof(str0), fmt_str0, hours);
	SendClientMessageToAll(-1, str0);
	SendClientMessageToAll(-1, "    БАНКОВСКИЙ ЧЕК");
	SendClientMessageToAll(-1, "______________________");
	foreach(new i : Player)
	{
		switch(p_info[i][p_admin])
		{
		    case 1: payday_donat[i] = 5;
			case 2: payday_donat[i] = 10;
			case 3: payday_donat[i] = 15;
			case 4: payday_donat[i] = 20;
			case 5: payday_donat[i] = 25;
		}
		switch(p_info[i][p_kills])
		{
		    case 0..100: payday_kills[i] = 5;
		    case 101..200: payday_kills[i] = 10;
		    case 201..300: payday_kills[i] = 15;
		    case 301..400: payday_kills[i] = 20;
		    case 401..500: payday_kills[i] = 25;
		    case 501..600: payday_kills[i] = 30;
		    case 601..700: payday_kills[i] = 35;
		    case 701..800: payday_kills[i] = 40;
		    case 801..900: payday_kills[i] = 45;
		    case 901..1000: payday_kills[i] = 50;
		}
		if(p_info[i][p_admin] > 0)
		{
			static const fmt_str1[] = "Админ - зарплата: {66CC00}%d donat bonus";
			new str1[sizeof fmt_str1 + 41];
			format(str1, sizeof(str1), fmt_str1, payday_donat[i]);
			SendClientMessage(i, -1, str1);
			p_info[i][p_donat] += payday_donat[i];
		}
		else
		{
			static const fmt_str3[] = "Зарплата: {66CC00}%d киллов";
			new str3[sizeof fmt_str3 + 28];
			format(str3, sizeof(str3), fmt_str3, payday_kills[i]);
			SendClientMessage(i, -1, str3);
			p_info[i][p_kills] += payday_kills[i];
			SetPlayerScore(i, p_info[i][p_kills]);
		}
		p_info[i][p_in_game] = 0;
	}
	SendClientMessageToAll(-1, "\n______________________");
	return true;
}

stock OnMonitoringTimer()
{
	static const fmt_str[] = "%d";
	new
		str[sizeof fmt_str + 11],
	    players[5];
	foreach(new i: Player)
	{
		switch(p_virable[i][p_gang])
		{
			case 1: players[0]++;
			case 2: players[1]++;
			case 3: players[2]++;
			case 4: players[3]++;
			case 5: players[4]++;
		}
	}
    format(str, sizeof(str), fmt_str, players[0]);
    TextDrawSetString(monitoring_TD[6], str);
	format(str, sizeof(str), fmt_str, players[1]);
	TextDrawSetString(monitoring_TD[7], str);
	format(str, sizeof(str), fmt_str, players[2]);
	TextDrawSetString(monitoring_TD[8], str);
	format(str, sizeof(str), fmt_str, players[3]);
	TextDrawSetString(monitoring_TD[9], str);
	format(str, sizeof(str), fmt_str, players[4]);
	TextDrawSetString(monitoring_TD[10], str);
}

stock OnCaptureTimer()
{
	time_to_expiration_capture --;
	static const
		fmt_str1[] = "Time: %s",
		fmt_str2[] = "%s: ~r~%i",
		fmt_str3[] = "%s: ~r~%i",
		fmt_str4[] = "Попытка %s захватить территорию у %s провалилась",
		fmt_str5[] = "%s захватили территорию у банды %s в районе %s";
	new
		str1[sizeof fmt_str1 + 11],
		str2[sizeof fmt_str2 + 27],
		str3[sizeof fmt_str3 + 27],
		str4[sizeof fmt_str4 + 18*2 + 54],
		str5[sizeof fmt_str5 + 18*2 + 40 + MAX_ZONE_NAME];
	format(str1, sizeof(str1), fmt_str1, converts_time(time_to_expiration_capture));
	TextDrawSetString(capture_textdraw[3], str1);
	format(str2, sizeof(str2), fmt_str2, organization_name[team_capture[0]-1], kills_team[0]);
	TextDrawSetString(capture_textdraw[1], str2);
	format(str3, sizeof(str3), fmt_str3, organization_name[team_capture[1]-1], kills_team[1]);
	TextDrawSetString(capture_textdraw[2], str3);
	if(!time_to_expiration_capture)
    {
        foreach(new i: Player)
        {
            GangZoneStopFlashForAll(capture_start);
            RemovePlayerMapIcon(i, 31);
            if(kills_team[0] == kills_team[1] || kills_team[0] < kills_team[1])
			{
			    format(str4, sizeof(str4), fmt_str4, organization_name[team_capture[0]-1], organization_name[team_capture[1]-1]);
			    SendClientMessage(i, 0xFF6600AA, str4);
			}
            else if(kills_team[0] > kills_team[1])
			{
			    format(str5, sizeof(str5), fmt_str5, organization_name[team_capture[0]-1], organization_name[team_capture[1]-1], name_zone);
			    SendClientMessage(i, 0xFF6600AA, str5);
                GangZoneHideForAll(capture_start);
	            GangZoneShowForAll(capture_start, OnGZColor(team_capture[0]));
                gangzone[0] = 0, gangzone[1] = 0, gangzone[2] = 0, gangzone[3] = 0, gangzone[4] = 0;
				for(new territory = 0; territory < sizeof(gz_info); territory++)
				{
				    switch(gz_info[territory][gz_gang])
				    {
				        case 1: gangzone[0]++;
				        case 2: gangzone[1]++;
				        case 3: gangzone[2]++;
				        case 4: gangzone[3]++;
				        case 5: gangzone[4]++;
				    }
				}
				gz_info[capture_start][gz_gang] = team_capture[0];
                OnGZSave(capture_start);
			}
            TextDrawHideForPlayer(i, capture_textdraw[0]);
            TextDrawHideForPlayer(i, capture_textdraw[1]);
            TextDrawHideForPlayer(i, capture_textdraw[2]);
            TextDrawHideForPlayer(i, capture_textdraw[3]);
            TextDrawHideForPlayer(i, capture_textdraw[4]);
        }
        capture_start = 0;
        there_is_capture = 0;
        time_to_expiration_capture = 0;
    }
    return true;
}

stock OnGZColor(fnumber)
{
    new
		fnumberid;
    switch(fnumber)
    {
		case 0: fnumberid = 0xFFFFFFAA;
        case 1: fnumberid = COLOR_GROVE;
		case 2: fnumberid = COLOR_BALLAS;
        case 3: fnumberid = COLOR_VAGOS;
        case 4: fnumberid = COLOR_AZTECAS;
        case 5: fnumberid = COLOR_RIFA;
    }
    return fnumberid;
}

stock PlayerToPoint(Float:radi, playerid, Float:x, Float:y, Float:z)
{
	if(IsPlayerConnected(playerid))
	{
	    new
	        Float: old_position[3],
			Float: temp_position[3];
		GetPlayerPos(playerid, old_position[0], old_position[1], old_position[2]);
		temp_position[0] = (old_position[0] -x);
		temp_position[1] = (old_position[1] -y);
		temp_position[2] = (old_position[2] -z);
		if(((temp_position[0] < radi) && (temp_position[0] > -radi)) && ((temp_position[1] < radi) && (temp_position[1] > -radi)) && ((temp_position[2] < radi) && (temp_position[2] > -radi)))
		return true;
	}
	return false;
}

stock OnPlayerDistanceChat(playerid, Float:range, string[])
{
	new
		Float: position[3], Float:radius;
	GetPlayerPos(playerid, position[0], position[1], position[2]);
	foreach(new i: Player)
	{
		if(GetPlayerVirtualWorld(playerid) == GetPlayerVirtualWorld(i))
		{
			radius = GetPlayerDistanceFromPoint(i, position[0], position[1], position[2]);
			if(radius < range/16) SendClientMessage(i, -1, string);
			else if(radius < range/8) SendClientMessage(i, -1, string);
			else if(radius < range/4) SendClientMessage(i, -1, string);
			else if(radius < range/2) SendClientMessage(i, -1, string);
			else if(radius < range) SendClientMessage(i, -1, string);
		}
	}
	return true;
}

stock PreloadAnimLib(playerid, animlib[])
{
   ApplyAnimation(playerid, animlib, "null", 0.0, 0, 0, 0, 0, 0);
   return true;
}

stock PreloadAllAnimLibs(playerid)
{
    PreloadAnimLib(playerid, "shop");
    PreloadAnimLib(playerid, "ped");
	return true;
}

stock converts_time(number)
{
	new
		hours = 0, mins = 0, secs = 0, string[30];
	hours = floatround(number / 3600);
	mins = floatround((number / 60) - (hours * 60));
	secs = floatround(number - ((hours * 3600) + (mins * 60)));
	if(hours > 0)
	{
		format(string, 30, "%d:%02d:%02d", hours, mins, secs);
	}
	else
	{
        format(string, 30, "%d:%02d", mins, secs);
	}
	return string;
}

stock OnPlayerShowStatistic(playerid, statsid)
{
	static const fmt_str[] = "{FFFFFF}Имя:\t\t\t\t{0099FF}%s\n{FFFFFF}Убийств:\t\t\t\t%d\nСмертей:\t\t\t\t%d\n\nОрганизация:\t\t\t%s\nРабота / должность:\t\t%s\n\nIP адресс (регис.):\t\t%s\nIP адресс (послед.):\t\t%s";
 	new str[sizeof fmt_str + 555];//edit string
	format(str, sizeof(str), fmt_str, p_info[statsid][p_name], p_info[statsid][p_kills], p_info[statsid][p_deaths], p_info[statsid][p_rip], p_info[statsid][p_lip], organization_name[p_virable[playerid][p_gang]-1], GetPlayerRang(playerid));
    ShowPlayerDialog(playerid, DIALOGUE_STATISTIC, DIALOG_STYLE_MSGBOX, "{CC9900}Статистика игрока", str, "Назад", "Закрыть");
    return true;
}

stock OnPlayerShowRules(playerid)
{
	new
	    str[1167];
    for(new i; i < 18; i++) format(str, sizeof(str), "%s%s", str, rules[i]);
    ShowPlayerDialog(playerid, DIALOGUE_RULES, DIALOG_STYLE_MSGBOX, "{66CCFF}Правила сервера", str, "Принять", "Отмена");
    return true;
}

stock OnPlayerShowSetting(playerid)
{
	new
	    standart_chat[50];
	switch(p_info[playerid][p_chat_standard])
	{
	    case 1: standart_chat = "{0099FF}Advance";
	    case 2: standart_chat = "{FF3333}Отключен";
	    case 3: standart_chat = "{00CC00}Стандарт";
	}
    static const fmt_str[] = "{FFFFFF}Основной чат:\t\t%s\n{FFFFFF}Чат организации:\t%s\n{FFFFFF}Ники над игроками:\t%s\n{FFFFFF}Ники в чате:\t\t%s\n{FFFFFF}ID игроков в чате:\t%s\n{888888}[Сохранить настройки]";
    new str[sizeof fmt_str + 40 + 41 + 44 + 39 + 44 + 29];
	format(str, sizeof(str), fmt_str,
	standart_chat,
	(p_info[playerid][p_chat_organization]) ? ("{00CC00}Включен") : ("{FF3333}Отключен"),
	(p_info[playerid][p_nick_over_player]) ? ("{00CC00}Включены") : ("{FF3333}Отключены"),
	(p_info[playerid][p_nick_in_chat]) ? ("{00CC00}Включены") : ("{FF3333}Отключены"),
	(p_info[playerid][p_id_in_chat]) ? ("{00CC00}Включены") : ("{FF3333}Отключены"));
	ShowPlayerDialog(playerid, DIALOGUE_SETTING, DIALOG_STYLE_LIST, "{FFCD00}Личные настройки", str, "Вкл|Выкл", "Назад");
	return true;
}

stock OnServerSettingShow(playerid)
{
    static const fmt_str[] = "{FFFFFF}Анти-сбив:\t\t\t%s\n{FFFFFF}Анти-мат:\t\t\t%s\n{FFFFFF}Общий чат:\t\t\t%s\n{FFFFFF}Информация о подключении:\t%s\n{FFFFFF}Разрешение на капт\t\t%s\n{FFFFFF}Выдача убийств:\t\t\t%s\n{FFFFFF}Анти-СК:\t\t\t%s";
    new str[sizeof fmt_str + 37 + 36 + 37 + 51 + 44 + 43 + 37];
    format(str, sizeof(str), fmt_str,
    (anti_sbiv) ? ("{00CC00}Включен") : ("{FF3333}Отключен"),
    (anti_mat) ? ("{00CC00}Включен") : ("{FF3333}Отключен"),
    (overall_chat) ? ("{00CC00}Включен") : ("{FF3333}Отключен"),
    (connect_ip_show) ? ("{00CC00}Включена") : ("{FF3333}Отключена"),
    (capture_on_off) ? ("{00CC00}Включен") : ("{FF3333}Отключен"),
	(set_score) ? ("{00CC00}Включена") : ("{FF3333}Отключена"),
	(anti_spawnkill) ? ("{00CC00}Включен") : ("{FF3333}Отключен"));
    ShowPlayerDialog(playerid, DIALOGUE_SERVER_SETTING, DIALOG_STYLE_LIST, "{FFCD00}Настройки сервера", str, "Вкл|Выкл", "Закрыть");
    return true;
}

stock GetPlayerRang(playerid)
{
	new
	    string[10];
    switch(p_info[playerid][p_kills])
    {
        case 0..100: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][0]);
        case 101..200: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][1]);
        case 201..300: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][2]);
        case 301..400: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][3]);
        case 401..500: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][4]);
        case 501..600: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][5]);
        case 601..700: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][6]);
        case 701..800: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][7]);
        case 801..900: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][8]);
        case 901..1000: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][9]);
        default: format(string, sizeof(string), organization_rang_name[p_virable[playerid][p_gang]-1][9]);
    }
    return string;
}

stock OnStartCapture(familyone, familytwo)
{
    foreach(new i: Player)
    {
        if(!p_virable[i][p_gang]) continue;
        {
            TextDrawHideForPlayer(i, capture_textdraw[0]);
            TextDrawShowForPlayer(i, capture_textdraw[1]);
            TextDrawShowForPlayer(i, capture_textdraw[2]);
            TextDrawShowForPlayer(i, capture_textdraw[3]);
            TextDrawShowForPlayer(i, capture_textdraw[4]);
		    static const
				fmt_str0[] = "%s начали захват территории банды %s в районе %s",
				fmt_str1[] = "%s ~r~%i";
			new
				str0[sizeof fmt_str0 + 18*2 + 42 + MAX_ZONE_NAME],
				str1[sizeof fmt_str1 + 27*2];
            format(str0, sizeof(str0), fmt_str0, organization_name[familyone-1], organization_name[familytwo-1], name_zone);
			SendClientMessage(i, 0xFF6600AA, str0);
   			format(str1, sizeof(str1), fmt_str1, organization_name[familyone-1], kills_team[0]);
            TextDrawSetString(capture_textdraw[1], str1);
            format(str1, sizeof(str1), fmt_str1, organization_name[familytwo-1], kills_team[1]);
            TextDrawSetString(capture_textdraw[2], str1);
        }
    }
    return true;
}

stock IsVehicleOccupied(vehicleid)
{
	foreach(new i: Player)
	{
		if(IsPlayerInVehicle(i, vehicleid))
		return true;
	}
	return false;
}

stock IsVehicleToRadius(Float: radius, vehicleid, Float: x, Float: y, Float: z)
{
	new
		Float: old_position[3], Float: temp_position[3];
	GetVehiclePos(vehicleid, old_position[0], old_position[1], old_position[2]);
	temp_position[0] = (old_position[0] -x);
	temp_position[1] = (old_position[1] -y);
	temp_position[2] = (old_position[2] -z);
	if(((temp_position[0] < radius) && (temp_position[0] > -radius)) && ((temp_position[1] < radius) && (temp_position[1] > -radius)) && ((temp_position[2] < radius) && (temp_position[2] > -radius)))
	{
		return true;
	}
	return false;
}

stock OnServerTD()
{
	logotyp_TD = TextDrawCreate(536.000000, 2.000000, "Advance GW");
	TextDrawLetterSize(logotyp_TD, 0.3600, 1.400000);
	TextDrawFont(logotyp_TD, 1);
	TextDrawColor(logotyp_TD, 0xDD70FFFF);
	TextDrawBackgroundColor(logotyp_TD, 0x660066FF);
	TextDrawSetOutline(logotyp_TD, 1);

	capture_textdraw[0]  = TextDrawCreate(13.00000, 278.00000, "");
	TextDrawAlignment(capture_textdraw[0] ,0);
	TextDrawBackgroundColor(capture_textdraw[0] ,0x000000AA);
	TextDrawFont(capture_textdraw[0] ,1);
	TextDrawSetOutline(capture_textdraw[0] , 1);
	TextDrawLetterSize(capture_textdraw[0] ,0.3200,1.600);
	TextDrawColor(capture_textdraw[0] ,0x00CC00AA);
	TextDrawSetProportional(capture_textdraw[0] ,1);

	capture_textdraw[1]  = TextDrawCreate(13.00000, 295.00000, "_");
	TextDrawAlignment(capture_textdraw[1] ,0);
	TextDrawBackgroundColor(capture_textdraw[1] ,0x000000AA);
	TextDrawFont(capture_textdraw[1] ,1);
	TextDrawSetOutline(capture_textdraw[1] , 1);
	TextDrawLetterSize(capture_textdraw[1] ,0.3200,1.600);
	TextDrawColor(capture_textdraw[1] ,0xFFFFFFAA);
	TextDrawSetProportional(capture_textdraw[1] ,1);

	capture_textdraw[2]  = TextDrawCreate(13.00000, 310.00000, "_");
	TextDrawAlignment(capture_textdraw[2] ,0);
	TextDrawBackgroundColor(capture_textdraw[2] ,0x000000AA);
	TextDrawFont(capture_textdraw[2] ,1);
	TextDrawSetOutline(capture_textdraw[2] , 1);
	TextDrawLetterSize(capture_textdraw[2] ,0.3200,1.600);
	TextDrawColor(capture_textdraw[2] ,0xFFFFFFAA);
	TextDrawSetProportional(capture_textdraw[2] ,1);

	capture_textdraw[3]  = TextDrawCreate(13.00000, 278.00000, "Time:");
	TextDrawAlignment(capture_textdraw[3] ,0);
	TextDrawBackgroundColor(capture_textdraw[3] ,0x000000AA);
	TextDrawFont(capture_textdraw[3] ,1);
	TextDrawSetOutline(capture_textdraw[3] , 1);
	TextDrawLetterSize(capture_textdraw[3] ,0.3200,1.600);
	TextDrawColor(capture_textdraw[3] ,0x00CC00AA);
	TextDrawSetProportional(capture_textdraw[3] ,1);
	
   	capture_textdraw[4] = TextDrawCreate(3.000000, 275.000000, "_");
    TextDrawLetterSize(capture_textdraw[4], 0.500000, 5.899998);
    TextDrawTextSize(capture_textdraw[4], 145.000000, 0.000000);
    TextDrawAlignment(capture_textdraw[4], 1);
    TextDrawColor(capture_textdraw[4], 0);
    TextDrawUseBox(capture_textdraw[4], true);
    TextDrawBoxColor(capture_textdraw[4], 102);
    TextDrawSetOutline(capture_textdraw[4], 0);
    TextDrawFont(capture_textdraw[4], 0);
    
	monitoring_TD[0] = TextDrawCreate(426.000000, 408.375000, "usebox");
	TextDrawLetterSize(monitoring_TD[0], 0.000000, 3.001389);
	TextDrawTextSize(monitoring_TD[0], 159.000000, 0.000000);
	TextDrawAlignment(monitoring_TD[0], 1);
	TextDrawColor(monitoring_TD[0], 0);
	TextDrawUseBox(monitoring_TD[0], true);
	TextDrawBoxColor(monitoring_TD[0], 102);
	TextDrawSetShadow(monitoring_TD[0], 0);
	TextDrawSetOutline(monitoring_TD[0], 0);
	TextDrawFont(monitoring_TD[0], 0);
	
	monitoring_TD[1] = TextDrawCreate(168.000000, 407.750000, "GROVE");
	TextDrawLetterSize(monitoring_TD[1], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[1], 1);
	TextDrawColor(monitoring_TD[1], COLOR_GROVE);
	TextDrawSetShadow(monitoring_TD[1], 0);
	TextDrawSetOutline(monitoring_TD[1], 1);
	TextDrawBackgroundColor(monitoring_TD[1], 51);
	TextDrawFont(monitoring_TD[1], 3);
	TextDrawSetProportional(monitoring_TD[1], 1);

	monitoring_TD[2] = TextDrawCreate(216.500000, 407.750000, "BALLAS");
	TextDrawLetterSize(monitoring_TD[2], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[2], 1);
	TextDrawColor(monitoring_TD[2], COLOR_BALLAS);
	TextDrawSetShadow(monitoring_TD[2], 0);
	TextDrawSetOutline(monitoring_TD[2], 1);
	TextDrawBackgroundColor(monitoring_TD[2], 51);
	TextDrawFont(monitoring_TD[2], 3);
	TextDrawSetProportional(monitoring_TD[2], 1);

	monitoring_TD[3] = TextDrawCreate(269.500000, 407.750000, "VAGOS");
	TextDrawLetterSize(monitoring_TD[3], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[3], 1);
	TextDrawColor(monitoring_TD[3], COLOR_VAGOS);
	TextDrawSetShadow(monitoring_TD[3], 0);
	TextDrawSetOutline(monitoring_TD[3], 1);
	TextDrawBackgroundColor(monitoring_TD[3], 51);
	TextDrawFont(monitoring_TD[3], 3);
	TextDrawSetProportional(monitoring_TD[3], 1);

	monitoring_TD[4] = TextDrawCreate(319.000000, 407.750000, "AZTECAS");
	TextDrawLetterSize(monitoring_TD[4], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[4], 1);
	TextDrawColor(monitoring_TD[4], COLOR_AZTECAS);
	TextDrawSetShadow(monitoring_TD[4], 0);
	TextDrawSetOutline(monitoring_TD[4], 1);
	TextDrawBackgroundColor(monitoring_TD[4], 51);
	TextDrawFont(monitoring_TD[4], 3);
	TextDrawSetProportional(monitoring_TD[4], 1);

	monitoring_TD[5] = TextDrawCreate(387.000000, 407.750000, "RIFA");
	TextDrawLetterSize(monitoring_TD[5], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[5], 1);
	TextDrawColor(monitoring_TD[5], COLOR_RIFA);
	TextDrawSetShadow(monitoring_TD[5], 0);
	TextDrawSetOutline(monitoring_TD[5], 1);
	TextDrawBackgroundColor(monitoring_TD[5], 51);
	TextDrawFont(monitoring_TD[5], 3);
	TextDrawSetProportional(monitoring_TD[5], 1);

	monitoring_TD[6] = TextDrawCreate(186.000000, 422.187500, "0");
	TextDrawLetterSize(monitoring_TD[6], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[6], 1);
	TextDrawColor(monitoring_TD[6], -1);
	TextDrawSetShadow(monitoring_TD[6], 0);
	TextDrawSetOutline(monitoring_TD[6], 1);
	TextDrawBackgroundColor(monitoring_TD[6], 51);
	TextDrawFont(monitoring_TD[6], 3);
	TextDrawSetProportional(monitoring_TD[6], 1);

	monitoring_TD[7] = TextDrawCreate(235.500000, 422.187500, "0");
	TextDrawLetterSize(monitoring_TD[7], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[7], 1);
	TextDrawColor(monitoring_TD[7], -1);
	TextDrawSetShadow(monitoring_TD[7], 0);
	TextDrawSetOutline(monitoring_TD[7], 1);
	TextDrawBackgroundColor(monitoring_TD[7], 51);
	TextDrawFont(monitoring_TD[7], 3);
	TextDrawSetProportional(monitoring_TD[7], 1);

	monitoring_TD[8] = TextDrawCreate(288.000000, 422.625000, "0");
	TextDrawLetterSize(monitoring_TD[8], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[8], 1);
	TextDrawColor(monitoring_TD[8], -1);
	TextDrawSetShadow(monitoring_TD[8], 0);
	TextDrawSetOutline(monitoring_TD[8], 1);
	TextDrawBackgroundColor(monitoring_TD[8], 51);
	TextDrawFont(monitoring_TD[8], 3);
	TextDrawSetProportional(monitoring_TD[8], 1);

	monitoring_TD[9] = TextDrawCreate(347.000000, 422.187500, "0");
	TextDrawLetterSize(monitoring_TD[9], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[9], 1);
	TextDrawColor(monitoring_TD[9], -1);
	TextDrawUseBox(monitoring_TD[9], true);
	TextDrawBoxColor(monitoring_TD[9], 0);
	TextDrawSetShadow(monitoring_TD[9], 0);
	TextDrawSetOutline(monitoring_TD[9], 1);
	TextDrawBackgroundColor(monitoring_TD[9], 51);
	TextDrawFont(monitoring_TD[9], 3);
	TextDrawSetProportional(monitoring_TD[9], 1);

	monitoring_TD[10] = TextDrawCreate(395.000000, 422.187500, "0");
	TextDrawLetterSize(monitoring_TD[10], 0.449999, 1.600000);
	TextDrawAlignment(monitoring_TD[10], 1);
	TextDrawColor(monitoring_TD[10], -1);
	TextDrawSetShadow(monitoring_TD[10], 0);
	TextDrawSetOutline(monitoring_TD[10], 1);
	TextDrawBackgroundColor(monitoring_TD[10], 51);
	TextDrawFont(monitoring_TD[10], 3);
	TextDrawSetProportional(monitoring_TD[10], 1);
}

//Команды сервера
ALTX:menu("/mn");
CMD:menu(playerid, params[])
{
	ShowPlayerDialog(playerid, DIALOGUE_MENU, DIALOG_STYLE_LIST, "{0099CC}Меню игрока", "\
	1. Статистика\n\
	2. Список команд\n\
	3. Личные настройки\n\
	4. Настройки безопасности\n\
	5. Связь с администрацией\n\
	6. Улучшение\n\
	7. Правила сервера\n\
	8. Изменить имя\n\
	9. Дополнительно\n\
	10. ТОП 10 игроков", "Выбрать", "Закрыть");
}

CMD:healme(playerid, params[])
{
    new
		Float: max_health;
	if(p_virable[playerid][p_heal] == 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет аптечки!");
	SetPlayerChatBubble(playerid, "+ 60 HP", 0x0099FFAA, 10.0, 2000);
 	GameTextForPlayer(playerid, "~b~+ 60 hp", 1000, 1);
  	SendClientMessage(playerid, 0x0099FFAA, "Вы использовали аптечку! Ваше здоровье пополнено.");
	p_virable[playerid][p_heal] -= 1;
    ApplyAnimation(playerid, "ped", "gum_eat", 4.0, 0, 0, 0, 0, 0, 1);
 	GetPlayerHealth(playerid, max_health);
 	if(anti_sbiv == false)
 	{
	    if(max_health + 60 <= 100)
		{
			SetPlayerHealth(playerid, max_health + 60.0);
		}
	    else
		{
	 		SetPlayerHealth(playerid, 100);
	 	}
	 	return true;
	}
	else
	{
	    new
			Float: position[3];
	    GetPlayerPos(playerid, position[0], position[1], position[2]);
	    SetTimerEx("OnPlayerSbivAnimation", 5000, false, "dfff", playerid, position[0], position[1], position[2]);
	}
	return true;
}

CMD:mask(playerid, params[])
{
	if(p_virable[playerid][p_mask] == 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет маски !");
	SetPlayerChatBubble(playerid, "Одевает маску", 0x0099FFAA, 10.0, 2000);
	GameTextForPlayer(playerid, "~b~IVISIBLE ON", 1000, 1);
	ApplyAnimation(playerid, "shop", "ROB_Shifty", 4.0, 0, 0, 0, 0, 0, 1);
	SetPlayerColor(playerid, 0xA5A5A500);
	p_virable[playerid][p_mask] = 0;
	SendClientMessage(playerid, 0x0099FFAA, "Ваше месторасположение на GPS скрыто");
	return true;
}

ALTX:newgang("/newband");
CMD:newgang(playerid, params[])
{
    ShowPlayerDialog(playerid, DIALOGUE_CHOICE_GANG, DIALOG_STYLE_LIST, "{66CCFF}Выберите банду", "1. Grove Street\n2. The Ballas\n3. Los Santos Vagos\n4. Varios Los Aztecas\n5. The Rifa", "Выбрать", "Выйти");
}

CMD:capture(playerid, params[])
{
	if(capture_on_off == true)
	{
	    for(new i = 0; i != sizeof(gz_info); i++)
	    {
		    if(OnSquared(playerid, gz_info[i][gz_coords][0], gz_info[i][gz_coords][1], gz_info[i][gz_coords][2], gz_info[i][gz_coords][3]))// return SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы должны находиться на территории банды, которую хотите захватить");
	        {
		        if(p_virable[playerid][p_gang] == gz_info[i][gz_gang]) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Эта территория принадлежит вашей банде");
	            if(there_is_capture == 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Уже происходит захват одной из зон. Дождитесь окончания!");
	            switch(i)
	            {
	                case 7, 25, 67, 74, 90: return SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы не можете начать захват территорий респаувна банды!");
	            }
	            new
		           Float:x = (gz_info[i][gz_coords][0]+gz_info[i][gz_coords][2])/2.0,
	               Float:y = (gz_info[i][gz_coords][1]+gz_info[i][gz_coords][3])/2.0,
	               Float:z = 0;
	           	foreach(new a: Player)
	            {
	                switch(p_virable[playerid][p_gang])
	                {
	                    case 1: SetPlayerMapIcon(a, 31, x, y , z, 62, 0, MAPICON_GLOBAL);
	                    case 2: SetPlayerMapIcon(a, 31, x, y , z, 60, 0, MAPICON_GLOBAL);
	                    case 3: SetPlayerMapIcon(a, 31, x, y , z, 59, 0, MAPICON_GLOBAL);
	                    case 4: SetPlayerMapIcon(a, 31, x, y , z, 58, 0, MAPICON_GLOBAL);
	                    case 5: SetPlayerMapIcon(a, 31, x, y , z, 61, 0, MAPICON_GLOBAL);
	                }
	            }
	            GetPlayer2DZone(playerid, name_zone, MAX_ZONE_NAME);
	            time_to_expiration_capture = 420;
		        kills_team[0] = 0;
	            kills_team[1] = 0;
	            capture_start = i;
	            there_is_capture = 1;
	            GangZoneFlashForAll(capture_start, OnGZColor(p_virable[playerid][p_gang]));
	            OnStartCapture(p_virable[playerid][p_gang], gz_info[i][gz_gang]);
	            team_capture[0] = p_virable[playerid][p_gang];
	            team_capture[1] = gz_info[i][gz_gang];
	            static const fmt_str[] = "%s %s инициировал захват";
				new str[sizeof fmt_str + MAX_PLAYER_NAME + 19];
	            format(str, sizeof(str), fmt_str, GetPlayerRang(playerid), p_info[playerid][p_name]);
				SendGhettoMessage(team_capture[0], -1, str);
	            SendGhettoMessage(team_capture[0], 0xFFFF00AA, "Место отмечено на GPS. Отправляйтесь туда и поддержите свою банду");
	            SendGhettoMessage(team_capture[1], 0xFFFF00AA, "Место отмечено на GPS. Отправляйтесь туда и поддержите свою банду");
	            return true;
	        }
	    }
	}
	else
	{
	    SendClientMessage(playerid, COLOR_DARKORANGE, "Захват территорий отключен администрацией сервера!");
	}
    return true;
}

CMD:f(playerid, params[])
{
    static const fmt_str[] = "[F] %s %s[%d]: %s";
	new str[sizeof fmt_str + 12 + 20 + MAX_PLAYER_NAME + 128];
	new fraction = p_virable[playerid][p_gang];
    if(sscanf(params, "s[128]", params[0])) return  SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /f [текст]");
    if(p_info[playerid][p_mute]  > 0) return SendClientMessage(playerid, 0xff6600AA, "Доступ в чат заблокирован. Узнать время до окончания бана чата {66CC33}/time");
    format(str, sizeof(str), fmt_str, GetPlayerRang(playerid), p_info[playerid][p_name], playerid, params[0]);
	SendGhettoMessage(fraction, 0x6699ccAA, str);
	return true;
}

CMD:changeskin(playerid, params[])
{
	switch(p_virable[playerid][p_gang])
	{
		case 1: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_SKIN_GROVE, DIALOG_STYLE_LIST, "Выберите внешность для игрока:", "Скин 1 (id 86)\nСкин 2 (id 105)\nСкин 3 (id 106)\nСкин 4 (id 107)\nСкин 5 (id 149)\nСкин 6 (id 195)\nСкин 7 (id 269)\nСкин 8 (id 270)\nСкин 9 (id 271)", "Ок", "Закрыть");
		case 2: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_SKIN_BALLAS, DIALOG_STYLE_LIST, "Выберите внешность для игрока:", "Скин 1 (id 102)\nСкин 2 (id 103)\nСкин 3 (id 104)\nСкин 4 (id 195)", "Ок", "Закрыть");
		case 3: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_SKIN_VAGOS, DIALOG_STYLE_LIST, "Выберите внешность для игрока:", "Скин 1 (id 108)\nСкин 2 (id 109)\nСкин 3 (id 110)\nСкин 4 (id 190)", "Ок", "Закрыть");
		case 4: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_SKIN_AZTEC, DIALOG_STYLE_LIST, "Выберите внешность для игрока:", "Скин 1 (id 114)\nСкин 2 (id 115)\nСкин 3 (id 116)\nСкин 4 (id 292)\nСкин 5 (id 193)", "Ок", "Закрыть");
		case 5: ShowPlayerDialog(playerid, DIALOGUE_CHANGE_SKIN_RIFA, DIALOG_STYLE_LIST, "Выберите внешность для игрока:", "Скин 1 (id 173)\nСкин 2 (id 174)\nСкин 3 (id 175)\nСкин 4 (id 273)\nСкин 5 (id 226)", "Ок", "Закрыть");
	}
	return true;
}

CMD:time(playerid, params[])
{
	if(p_info[playerid][p_jail] < 0 && p_info[playerid][p_jail] < 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Введите /c"); //Исправить текст
	if(p_info[playerid][p_jail] > 0)
	{
		static const fmt_str[] = "Время до выхода на свободу: %s";
		new str[sizeof fmt_str + 34];
		format(str, sizeof(str), fmt_str, converts_time(p_info[playerid][p_jail]));
		SendClientMessage(playerid, 0x66cc00AA, str);
	}
	if(p_info[playerid][p_mute] > 0)
	{
		static const fmt_str[] = "Время до разблокировки чата: %s";
		new str[sizeof fmt_str + 34];
		format(str, sizeof(str), fmt_str, converts_time(p_info[playerid][p_mute]));
		SendClientMessage(playerid, 0x66cc00AA, str);
	}
	return true;
}

ALTX:call("/c");
CMD:call(playerid, params[])
{
	static const fmt_str[] = "\
	{FFFFFF}Здраствуйте!\nВы позванили в службу точного времени\n\n\
	Сегодняшняя дата:\t\t{66CC00}%d %s %d г.\n\
	{FFFFFF}День недели:\t\t\t{66CC00}%s\n\
	{FFFFFF}Текущее время:\t\t\t{3399FF}%02d:%02d\n\n\
	{FFFFFF}Время в игре за час:\t\t{FF9999}%d мин";
/*
	{FFFFFF}Время в игре сегодня:\t\t{FFCC00}%s\n\
	{FFFFFF}Время в игре вчера:\t\t{FFCC00}%s\n\
	{FFFFFF}AFK за сегодня:\t\t{FF7000}%s\n\
	{FFFFFF}AFK за вчера:\t\t{FF7000}%s";
*/
	new
		str[sizeof fmt_str + 555],//edit string
		day, month, year, hour, minute, month_str[12], day_str[12];
	getdate(day, month, year);
	gettime(hour, minute);
	switch(day)
	{
		case 0: day_str = "конец света";
		case 1: day_str = "Понедельник";
		case 2: day_str = "Вторник";
		case 3: day_str = "Среда";
		case 4: day_str = "Четверг";
		case 5: day_str = "Пятница";
		case 6: day_str = "Суббота";
		default: day_str = "Воскресенье";
	}
    switch(month)
    {
        case 0: month_str = "конец света";
		case 1: month_str = "января";
		case 2: month_str = "февраля";
		case 3: month_str = "марта";
		case 4: month_str = "апреля";
		case 5: month_str = "мая";
		case 6: month_str = "июня";
		case 7: month_str = "июля";
		case 8: month_str = "августа";
		case 9: month_str = "сентября";
		case 10: month_str = "октября";
		case 11: month_str = "ноября";
		default: month_str = "декабря";
    }
	format(str, sizeof(str), fmt_str, year, month_str, day, day_str, hour, minute, p_info[playerid][p_in_game]);
	ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, "{FFCD00}Точное время", str, "Закрыть", "");
	SendClientMessage(playerid, 0x66cc00AA, "Вы позвонили в службу точного времени");
    return true;
}

ALTX:sms("/pm");
CMD:sms(playerid, params[])
{
    static const
		fmt_str0[] = "SMS: %s | Отправитель: %s[%d]",
		fmt_str1[] = "SMS: %s | Получатель: %s[%d]",
		fmt_str2[] = "[A][SMS]: %s | Отправил %s[%d] для %s[%d]";
	new
		str0[sizeof fmt_str0 + 26 + MAX_PLAYER_NAME + 30],
		str1[sizeof fmt_str1 + 25 + MAX_PLAYER_NAME + 30],
		str2[sizeof fmt_str2 + 37 + MAX_PLAYER_NAME*2 + 30];
	if(p_info[playerid][p_mute] > 0) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вы не можете отправлять SMS-сообщения");
    if(sscanf(params, "ds[50]", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /sms [id игрока] [текст]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    format(str0, sizeof(str0), fmt_str0, params[1], p_info[playerid][p_name], playerid);
	SendClientMessage(params[0], COLOR_YELLOW, str0);
	format(str1, sizeof(str1), fmt_str1, params[1], p_info[params[0]][p_name], params[0]);
	SendClientMessage(playerid, COLOR_YELLOW, str1);
	if(watch_pm == true)
	{
	    format(str2, sizeof(str2), fmt_str2, params[1], p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0]);
		SendAdminMessage(COLOR_YELLOW, str2);
	}
	return true;
}

CMD:o(playerid, params[])
{
    static const
        fmt_str0[] = "[Общий чат][VIP игрок] [%s] %s[%d]: %s",
		fmt_str1[] = "[Oбщий чат] [%s] %s[%d]: %s";
    new str[sizeof fmt_str0 + 40 + MAX_PLAYER_NAME + 128];
	if(p_info[playerid][p_mute]  > 0) return SendClientMessage(playerid, 0xff6600AA, "Доступ в чат заблокирован. Узнать время до окончания бана чата {66CC33}/time");
	if(p_info[playerid][p_kills] <= 100) return SendClientMessage(playerid, COLOR_DARKORANGE, "Вам недоступен общий чат, необходимо иметь 100 убийств");
	if(overall_chat == true)
	{
		if(p_info[playerid][p_vip] >= 1)
		{
			if(sscanf(params, "s[128]", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /o [текст]");
			format(str, sizeof(str), fmt_str0, reduced_organization_name[p_virable[playerid][p_gang]-1], p_info[playerid][p_name], playerid, params[0]);
			SendClientMessageToAll(0xFFFFFFFF, str);
		}
		else
		{
			if(sscanf(params, "s[128]", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /o [текст]");
			format(str, sizeof(str), fmt_str1, reduced_organization_name[p_virable[playerid][p_gang]-1], p_info[playerid][p_name], playerid, params[0]);
			SendClientMessageToAll(0xFFFFFFFF, str);
		}
	}
	else
	{
	    SendClientMessage(playerid, COLOR_DARKORANGE, "Общий чат отключен администрацией сервера!");
	}
	return true;
}

CMD:tp(playerid, params[])
{
    if(p_info[playerid][p_jail] > 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Вы в тюрьме!");
    if(teleport_the_event == 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Функция отключена администратором");
    ShowPlayerDialog(playerid, DIALOGUE_TELEPORT_EVENT, DIALOG_STYLE_MSGBOX, "{d2be5a}Телепортация", "Вы уверены, что хотите попасть в место проведения мероприятия?", "Да", "Нет");
    return true;
}

CMD:adm(playerid, params[])
{
	static const fmt_str[] = "SELECT * FROM `accounts_adm` WHERE `name` = '%s'";
   	new mysql_str[sizeof fmt_str + 44 + MAX_PLAYER_NAME];
	format(mysql_str, sizeof(mysql_str), fmt_str, p_info[playerid][p_name]);
	mysql_function_query(database, mysql_str, true, "OnPlayerAccountAdminCheck", "i", playerid);
    return true;
}

CMD:play(playerid, params[])
{
	if(GetPVarInt(playerid, "radio_enabled"))
	{
 		SetPVarInt(playerid, "InternetRadioEnabled", false);
		StopAudioStreamForPlayer(playerid);
		SendClientMessage(playerid, 0xFF9900AA, "Радио отключено.");
	}
	else
	{
    	ShowPlayerDialog(playerid, DIALOGUE_RADIO, DIALOG_STYLE_LIST, "{66CCFF}Онлайн радио", "1. Advance Radio\n2. Радио Мелодия\n3. Kiss FM (UA)\n4. Радио Шансон\n5. Радио Рекорд\n6. Sky Radio\n7. DFM Radio\n8. Rock Online", "Выбрать", "Закрыть");
    }
    return true;
}
//VIP команды
CMD:hhelp(playerid, params[])
{
    if(p_info[playerid][p_vip] < 1) return true;
    if(p_info[playerid][p_vip] >= 1) SendClientMessage(playerid, COLOR_YELLOW, "Доступные команды:");
	if(p_info[playerid][p_vip] >= 1) SendClientMessage(playerid, COLOR_YELLOW, "1 уровень: /hhelp /v");
    if(p_info[playerid][p_vip] >= 2) SendClientMessage(playerid, COLOR_YELLOW, "2 уровень: /giveheal");
    if(p_info[playerid][p_vip] >= 3) SendClientMessage(playerid, COLOR_YELLOW, "3 уровень: ");
    return true;
}

CMD:v(playerid, params[])
{
    static const fmt_str[] = "[VIP] %s[%d]: %s";
	new str[sizeof fmt_str + 13 + MAX_PLAYER_NAME + 144];
    if(p_info[playerid][p_vip] < 1) return true;
    if(sscanf(params, "s[144]", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /v [текст]");
	format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, params[0]);
	SendVIPMessage(COLOR_YELLOW, str);
	return true;
}

CMD:giveheal(playerid, params[])
{
	static const
	    fmt_str0[] = "Игрок %s[%d] передал вам аптечку",
	    fmt_str1[] = "Вы передали %s[%d] аптечку";
	new
		str0[sizeof fmt_str0 + 555],//edit string
		str1[sizeof fmt_str1 + 555];//edit string
	if(p_info[playerid][p_vip] < 2) return true;
	if(p_virable[playerid][p_heal] <= 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У Вас нет аптечки!");
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /givehelme [id игрока]");
	if(p_virable[params[0]][p_heal] == 3) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У игрока в наличии 3 аптечки.");
	p_virable[playerid][p_heal] -= 1;
	p_virable[params[0]][p_heal] += 1;
	format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], playerid);
	SendClientMessage(params[0], COLOR_YELLOW, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[params[0]][p_name], params[0]);
	SendClientMessage(playerid, COLOR_YELLOW, str1);
	return true;
}
//Административные команды сервера
CMD:ahelp(playerid, params[])
{
    if(p_info[playerid][p_admin] < 1) return true;
    if(p_info[playerid][p_admin] >= 1) SendClientMessage(playerid, COLOR_YELLOW, "Доступные команды:");
	if(p_info[playerid][p_admin] >= 1) SendClientMessage(playerid, 0xB8860BFF, "1 уровень: /sp /weap /stats /a /ans /admins");
    if(p_info[playerid][p_admin] >= 2) SendClientMessage(playerid, 0xB8860BFF, "2 уровень: /kick /setint /mute /unmute");
    if(p_info[playerid][p_admin] >= 3) SendClientMessage(playerid, 0xB8860BFF, "3 уровень: /ban /inter /skick /ip /lip /respv /goto");
	if(p_info[playerid][p_admin] >= 3) SendClientMessage(playerid, 0xB8860BFF, "3 уровень: /get /jail /unjail");
    if(p_info[playerid][p_admin] >= 4) SendClientMessage(playerid, 0xB8860BFF, "4 уровень: /rban /unrban /offban /unban /settp /reloadbans");
	if(p_info[playerid][p_admin] >= 4) SendClientMessage(playerid, 0xB8860BFF, "4 уровень: /setweather /settime /msg /ears /gethere /hp /hpall /skin");
	if(p_info[playerid][p_admin] >= 5) SendClientMessage(playerid, 0xB8860BFF, "5 уровень: /setscore");
	if(!strcmp(p_info[playerid][p_name], ""NAME_DEVELOPER_ONE"", true)) SendClientMessage(playerid, 0xB8860BFF, "6 уровень: /gzcolor /apanel /setadmin /setvip");
	return true;
}

CMD:sp(playerid, params[])
{
	new
	    Float: position[3];
	if(p_info[playerid][p_admin] < 1) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /sp [id игрока]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	spectrate_player_id[playerid] = params[0];
	switch(GetPlayerState(params[0]))
 	{
 	    case 1: PlayerSpectatePlayer(playerid, params[0]);
 	    case 2..3: PlayerSpectateVehicle(playerid, GetPlayerVehicleID(params[0]));
		default: return false;
 	}
 	ShowMenuForPlayer(spectrate_menu, playerid);
	SetPlayerInterior(playerid, GetPlayerInterior(params[0]));
	SetPlayerVirtualWorld(playerid, GetPlayerVirtualWorld(params[0]));
	TogglePlayerSpectating(playerid, 1);
	SetPVarInt(playerid, "spectrate_id", params[0]);
	GetPlayerPos(playerid, position[0], position[1], position[2]);
	SetPVarFloat(playerid, "position_spectrate_x", position[0]);
	SetPVarFloat(playerid, "position_spectrate_y", position[1]);
	SetPVarFloat(playerid, "position_spectrate_z", position[2]);
	SetPVarInt(playerid, "virtualworld_spectrate", GetPlayerVirtualWorld(playerid));
	SetPVarInt(playerid, "interior_spectrate", GetPlayerInterior(playerid));
	return true;
}

CMD:weap(playerid, params[])
{
	new
	    weapons[13][2], ammos[13][2],
		temp[64], str[1024];
    if(p_info[playerid][p_admin] < 1) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /weap [id игрока]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    for(new i = 0; i < 12; i++)
    {
        GetPlayerWeaponData(params[0], i, weapons[i][0], weapons[i][1]);
        format(temp, sizeof(temp), "{FFFFFF}Slot:%d Weaponid:%d   Ammo:%d\n", i, weapons[1], ammos[1]);
        strcat(str, temp, sizeof(str));
    }
    ShowPlayerDialog(playerid, DIALOGUE_INFORMATION, DIALOG_STYLE_MSGBOX, p_info[params[0]][p_name], str, "Ок","");
    return true;
}

CMD:stats(playerid, params[])
{
    if(p_info[playerid][p_admin] < 1) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /stats [id игрока]");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	OnPlayerShowStatistic(playerid, params[0]);
	return true;
}

CMD:a(playerid, params[])
{
    static const fmt_str[] = "[A] %s[%d]: %s";
	new str[sizeof fmt_str + 11 + MAX_PLAYER_NAME + 144];
    if(p_info[playerid][p_admin] < 1) return true;
    if(sscanf(params, "s[144]", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте (/a)admin [текст]");
	format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, params[0]);
	SendAdminMessage(0x99cc00AA, str);
	return true;
}

CMD:ans(playerid, params[])
{
	static const fmt_str[] = "Администратор %s[%d] для %s[%d]: %s";
	new str[sizeof fmt_str + 31*2 + MAX_PLAYER_NAME*4 + 144*2];
    if(p_info[playerid][p_admin] < 1) return true;
    if(sscanf(params, "ds[144]", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /ans [id игрока] [текст]");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0], params[1]);
	SendClientMessage(params[0], 0xFF9945AA, str);
    format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0], params[1]);
    SendAdminMessage(0xFF9945AA, str);
    return true;
}

CMD:admins(playerid)
{
    new
		name_admins[MAX_PLAYER_NAME],
		str0[MAX_PLAYER_NAME + (13 + 4 * 2)], str1[10], str2[512], str3[MAX_PLAYER_NAME + (13 + 4 * 2) + 33];
    if(p_info[playerid][p_admin] < 1) return true;
    SendClientMessage(playerid, 0x33CC00AA, "Админы онлайн:");
    foreach(new i : Player)
    {
        GetPlayerName(i, name_admins, sizeof(name_admins));
        if(p_info[i][p_admin] != 5)
        {
            format(str0, sizeof(str0), "%s[%d] (%d lvl)", name_admins, i, p_info[i][p_admin]);
        }
        if(spectrate_player_id[i] != INVALID_PLAYER_ID)
        {
            format(str1, sizeof(str1), "> /sp %d", spectrate_player_id[i]);
        }
        format(str3, sizeof(str3), "%s %s %s", p_info[i][p_admin] == 5 ? ("Главный администратор") : str0, spectrate_player_id[i] != INVALID_PLAYER_ID ? str1 : (""), afk_time[i] == 3 ? ("{ff0000}AFK") : (""));
        strcat(str2, str3);
    }
    return SendClientMessage(playerid, COLOR_YELLOW, str2);
}

CMD:kick(playerid, params[])
{
	static const
		fmt_str0[] = "Администратор %s кикнул игрока %s. Причина: %s",
	    fmt_str1[] = "Администратор %s кикнул игрока %s.";
	new
		str0[sizeof fmt_str0 + 40 + MAX_PLAYER_NAME*2 + 32],
		str1[sizeof fmt_str1 + 30 + MAX_PLAYER_NAME*2];
	if(p_info[playerid][p_admin] < 2) return true;
	if(sscanf(params, "uS()[32]", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /kick [id игрока] [причина]");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	if(!strlen(params[2]))
	{
		format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], p_info[params[0]][p_name]);
		SendClientMessageToAll(COLOR_RED, str1);
	}
	else
	{
		format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], p_info[params[0]][p_name], params[1]);
		SendClientMessageToAll(COLOR_RED, str0);
	}
	KickEx(params[0]);
	return true;
}

CMD:setint(playerid, params[])
{
	if(p_info[playerid][p_admin] < 2) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setint [id интерьера]");
	if(params[0] > 43 || params[0] < 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого интерьера нет.");
	switch(params[0])
	{
		case 1: SetPlayerPos(playerid, -25.884498,-185.868988,1003.546875), SetPlayerInterior(playerid, 17);
		case 2: SetPlayerPos(playerid, 1.808619,32.384357,1199.593750), SetPlayerInterior(playerid, 1);
		case 3: SetPlayerPos(playerid, 315.745086,984.969299,1958.919067), SetPlayerInterior(playerid, 9);
		case 4: SetPlayerPos(playerid, 286.148986,-40.644397,1001.515625), SetPlayerInterior(playerid, 1);
		case 5: SetPlayerPos(playerid, 302.292877,-143.139099,1004.062500), SetPlayerInterior(playerid, 7);
		case 6: SetPlayerPos(playerid, 1038.531372,0.111030,1001.284484), SetPlayerInterior(playerid, 3);
		case 7: SetPlayerPos(playerid, 2215.454833,-1147.475585,1025.796875), SetPlayerInterior(playerid, 15);
		case 8: SetPlayerPos(playerid, 833.269775,10.588416,1004.179687), SetPlayerInterior(playerid, 3);
		case 9: SetPlayerPos(playerid, -103.559165,-24.225606,1000.718750), SetPlayerInterior(playerid, 3);
		case 10: SetPlayerPos(playerid, -2240.468505,137.060440,1035.414062), SetPlayerInterior(playerid, 6);
		case 11: SetPlayerPos(playerid, 2169.461181,1618.798339,999.976562), SetPlayerInterior(playerid, 1);
		case 12: SetPlayerPos(playerid, -2159.122802,641.517517,1052.381713), SetPlayerInterior(playerid, 1);
		case 13: SetPlayerPos(playerid, 207.737991,-109.019996,1005.132812), SetPlayerInterior(playerid, 15);
		case 14: SetPlayerPos(playerid, 203.777999,-48.492397,1001.804687), SetPlayerInterior(playerid, 1);
		case 15: SetPlayerPos(playerid, 493.390991,-22.722799,1000.679687), SetPlayerInterior(playerid, 17);
		case 16: SetPlayerPos(playerid, -227.027999,1401.229980,27.765625), SetPlayerInterior(playerid, 18);
		case 17: SetPlayerPos(playerid, 457.304748,-88.428497,999.554687), SetPlayerInterior(playerid, 4);
		case 18: SetPlayerPos(playerid, 681.557861,-455.680053,-25.609874), SetPlayerInterior(playerid, 1);
		case 19: SetPlayerPos(playerid, 375.962463,-65.816848,1001.507812), SetPlayerInterior(playerid, 10);
		case 20: SetPlayerPos(playerid, 381.169189,-188.803024,1000.632812), SetPlayerInterior(playerid, 17);
		case 21: SetPlayerPos(playerid, 244.411987,305.032989,999.148437), SetPlayerInterior(playerid, 1);
		case 22: SetPlayerPos(playerid, 291.282989,310.031982,999.148437), SetPlayerInterior(playerid, 3);
		case 23: SetPlayerPos(playerid, 302.180999,300.722991,999.148437), SetPlayerInterior(playerid, 4);
		case 24: SetPlayerPos(playerid, 322.197998,302.497985,999.148437), SetPlayerInterior(playerid, 5);
		case 25: SetPlayerPos(playerid, 346.870025,309.259033,999.155700), SetPlayerInterior(playerid, 6);
		case 26: SetPlayerPos(playerid, -959.564392,1848.576782,9.000000), SetPlayerInterior(playerid, 17);
		case 27: SetPlayerPos(playerid, 384.808624,173.804992,1008.382812), SetPlayerInterior(playerid, 3);
		case 28: SetPlayerPos(playerid, 772.111999,-3.898649,1000.728820), SetPlayerInterior(playerid, 5);
		case 29: SetPlayerPos(playerid, 772.111999,-3.898649,1000.728820), SetPlayerInterior(playerid, 5);
		case 30: SetPlayerPos(playerid, 1527.229980,-11.574499,1002.097106), SetPlayerInterior(playerid, 3);
		case 31: SetPlayerPos(playerid, 1267.663208,-781.323242,1091.906250), SetPlayerInterior(playerid, 5);
		case 32: SetPlayerPos(playerid, 513.882507,-11.269994,1001.565307), SetPlayerInterior(playerid, 3);
		case 33: SetPlayerPos(playerid, 2543.462646,-1308.379882,1026.728393), SetPlayerInterior(playerid, 2);
		case 34: SetPlayerPos(playerid, 1212.019897,-28.663099,1000.953125), SetPlayerInterior(playerid, 3);
		case 35: SetPlayerPos(playerid, 761.412963,1440.191650,1102.703125), SetPlayerInterior(playerid, 6);
		case 36: SetPlayerPos(playerid, 942.171997,-16.542755,1000.929687), SetPlayerInterior(playerid, 3);
		case 37: SetPlayerPos(playerid, 964.106994,-53.205497,1001.124572), SetPlayerInterior(playerid, 3);
		case 38: SetPlayerPos(playerid, -2640.762939,1406.682006,906.460937), SetPlayerInterior(playerid, 3);
		case 39: SetPlayerPos(playerid, -729.276000,503.086944,1371.971801), SetPlayerInterior(playerid, 1);
		case 40: SetPlayerPos(playerid, -794.806396,497.738037,1376.195312), SetPlayerInterior(playerid, 1);
		case 41: SetPlayerPos(playerid, 2324.419921,-1145.568359,1050.710083), SetPlayerInterior(playerid, 12);
		case 42: SetPlayerPos(playerid, 207.054992,-138.804992,1003.507812), SetPlayerInterior(playerid, 3);
		case 43: SetPlayerPos(playerid, 226.293991,-7.431529,1002.210937), SetPlayerInterior(playerid, 5);
	}
	return true;
}

CMD:mute(playerid, params[])
{
	static const
		fmt_str0[] = "Администратор %s поставил затычку игроку %s на %d мин. Причина: %s",
	    fmt_str1[] = "Администратор %s поставил затычку игроку %s на %d мин.";
	new
		str0[sizeof fmt_str0 + 58 + MAX_PLAYER_NAME*2 + 32],
		str1[sizeof fmt_str1 + 48 + MAX_PLAYER_NAME*2];
    if(p_info[playerid][p_admin] < 2) return true;
	if(sscanf(params, "udS()[32]", params[0], params[1], params[2])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /mute [id игрока] [время] [причина]");
	if(p_info[params[0]][p_mute] > 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У игрока уже имеется бан чата!");
	if(params[1] > 300 || params[1] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Время бан чата от 1 до 300 минут!");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	if(!strlen(params[2]))
	{
		format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], p_info[params[0]][p_name], params[1]);
		SendClientMessageToAll(COLOR_RED, str1);
	}
	else
	{
		format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], p_info[params[0]][p_name], params[1], params[2]);
		SendClientMessageToAll(COLOR_RED, str0);
	}
	SendClientMessage(params[0], COLOR_LIGHTGREY, "Время до окончания бана чата: {99FF00}/time");
	p_info[params[0]][p_mute] = params[1]*60;
	return true;
}

CMD:unmute(playerid, params[])
{
    static const fmt_str[] = "Администратор %s снял бан чата у игрока %s.";
    new str[sizeof fmt_str + 40 + MAX_PLAYER_NAME*2];
	if(p_info[playerid][p_admin] < 2) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /unmute [id игрока]");
    if(p_info[params[0]][p_mute] == 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У игрока не имеется бан чата!");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	format(str, sizeof(str), fmt_str, p_info[playerid][p_name], p_info[params[0]][p_name]);
	SendClientMessageToAll(COLOR_RED, str);
	p_info[params[0]][p_mute] = 0;
	return true;
}

CMD:skick(playerid, params[])
{
	static const fmt_str[] = "[A] %s[%d] кикнул игрока %s[%d] без лишнего шума";
	new str[sizeof fmt_str + 46 + MAX_PLAYER_NAME*2];
	if(p_info[playerid][p_admin] < 3) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /skick [id игрока]");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0]);
	SendAdminMessage(COLOR_LIGHTGREY, str);
	KickEx(params[0]);
	return true;
}

CMD:ip(playerid, params[])
{
	static const fmt_str[] = "%s[%d] IP: %s";
	new str[sizeof fmt_str + 10 + 16 + MAX_PLAYER_NAME];
    if(p_info[playerid][p_admin] < 3) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /ip [id игрока]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    format(str, sizeof str, fmt_str, p_info[params[0]][p_name], params[0], p_ip[params[0]]);
	SendClientMessage(playerid, 0x33CCFFAA, str);
	return true;
}

CMD:lip(playerid, params[])
{
	return true;
}

CMD:respv(playerid, params[])
{
	new
	    Float: position[3];
	if(p_info[playerid][p_admin] < 3) return true;
	if(sscanf(params, "s", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /respv [рудиус]");
	if(params[0] > 80 || params[0] < 3) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Радиус от 3 до 80.");
	GetPlayerPos(playerid, position[0], position[1], position[2]);
	for(new i = 0; i < MAX_VEHICLES; i++)
	{
	    if(IsVehicleToRadius(params[0], i, position[0], position[1], position[2]) && !IsVehicleOccupied(i))
		{
			SetVehicleToRespawn(i);
			return true;
		}
	}
	SendClientMessage(playerid, 0x00FF00AA, "Машины в указанном радиусе были респавнены");
	return true;
}

CMD:goto(playerid, params[])
{
	static const fmt_str[] = "[A] %s[%d] телепортировался к игроку %s[%d]";
	new str[sizeof fmt_str + 41 + MAX_PLAYER_NAME*2], Float: position[3];
	if(p_info[playerid][p_admin] < 3) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /goto [id игрока]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    GetPlayerPos(params[0], position[0], position[1], position[2]);
    if(GetPlayerState(playerid) == 2)
	{
		SetVehiclePos(GetPlayerVehicleID(playerid), position[0], position[1]+4, position[2]);
	}
	else
	{
		SetPlayerPos(playerid, position[0], position[1]+2, position[2]);
	}
	SetPlayerInterior(playerid, GetPlayerInterior(params[0]));
	SetPlayerVirtualWorld(playerid, GetPlayerVirtualWorld(params[0]));
	format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0]);
	SendAdminMessage(COLOR_LIGHTGREY, str);
    GameTextForPlayer(playerid, "TELEPORT", 2000, 3);
    return true;
}

CMD:veh(playerid, params[])
{
	new
		Float: position[3];
	if(p_info[playerid][p_admin] < 4) return true;
 	if(sscanf(params, "ddd", params[0], params[1], params[2])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /veh [id автомобиля] [цвет1] [цвет2]");
	if(params[0] < 400 || params[0] > 611) return SendClientMessage(playerid, COLOR_LIGHTGREY, "ID`s машины не может быть меньше 400 и больше чем 611!");
 	if(params[1] < 0 || params[1] > 255) return SendClientMessage(playerid, COLOR_LIGHTGREY, "ID`s цвета не может быть меньше 0 и больше 126!");
  	if(params[2] < 0 || params[2] > 255) SendClientMessage(playerid, COLOR_LIGHTGREY, "Номер цвета не может быть меньше 0 и больше 126!");
   	GetPlayerPos(playerid, position[0], position[1], position[2]);
    CreateVehicle(params[0], position[0], position[1], position[2], 0.0, params[1], params[2], 60000);
    return true;
}

CMD:delveh(playerid, params[])
{
	if(p_info[playerid][p_admin] < 4) return true;
	if(GetPlayerState(playerid) != PLAYER_STATE_DRIVER) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Нужно находиться в автомобиле");
	RemovePlayerFromVehicle(playerid);
	DestroyVehicle(GetPlayerVehicleID(playerid));
	return true;
}

CMD:gethere(playerid, params[])
{
	static const
		fmt_str0[] = "[A] %s[%d] телепортировал к себе игрока %s[%d]",
		fmt_str1[] = "Администратор %s[%d] телепортировал Вас к себе";
	new
		str0[sizeof fmt_str0 + 44 + MAX_PLAYER_NAME*2],
		str1[sizeof fmt_str1 + 45 + MAX_PLAYER_NAME],
		Float: position[3];
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /gethere [id игрока]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    GetPlayerPos(playerid, position[0], position[1], position[2]);
	if(GetPlayerState(params[0]) == 2)
	{
		SetVehiclePos(GetPlayerVehicleID(params[0]), position[0], position[1]+4, position[2]);
	}
	else
	{
		SetPlayerPos(params[0], position[0], position[1]+2, position[2]);
	}
	SetPlayerInterior(params[0], GetPlayerInterior(playerid));
	SetPlayerVirtualWorld(params[0], GetPlayerVirtualWorld(playerid));
	format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0]);
	SendAdminMessage(COLOR_LIGHTGREY, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], playerid);
	SendClientMessage(params[0], -1, str1);
	return true;
}

CMD:get(playerid, params[])
{
    static const fmt_str[] = "SELECT * FROM `accounts` WHERE `name` = '%s'";
    new str[sizeof fmt_str + 24 + MAX_PLAYER_NAME], name[MAX_PLAYER_NAME];
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "s", name)) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /get [ник игрока или номер аккаунта]");
	format(str, sizeof(str), fmt_str, name);
    mysql_function_query(database, str, true, "OnPlayerAccountCheckAdmin", "ds", playerid, name);
    return true;
}

CMD:jail(playerid, params[])
{
	static const
		fmt_str0[] = "Администратор %s[%d] посадил Вас в тюрьму на %d мин (%s)",
		fmt_str1[] = "[A] %s[%d] посадил в тюрьму игрока %s[%d] на %d мин (%s)";
    new
		str0[sizeof fmt_str0 + 54 + MAX_PLAYER_NAME + 32],
		str1[sizeof fmt_str1 + 53 + MAX_PLAYER_NAME*2 + 32];
	if(p_info[playerid][p_admin] < 3) return true;
	if(sscanf(params, "dds[32]", params[0], params[1], params[2])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /jail [id игрока] [время] [причина]");
	if(p_info[params[0]][p_jail] > 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Данный игрок уже в тюрьме");
	if(params[1] > 300 || params[1] < 5) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Время тюрьмы не может быть меньше 5 минут и не больше 300 минут !");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], playerid, params[1], params[2]);
	SendClientMessage(params[0], 0xFF6600AA, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0], params[1], params[2]);
	SendAdminMessage(COLOR_LIGHTGREY, str1);
	SendClientMessage(params[0], 0xFF6600AA, "Время до выхода на свободу: {66CC33}/time");
	p_info[params[0]][p_jail] = params[1]*60;
	SpawnPlayer(params[0]);
	return true;
}

CMD:unjail(playerid, params[])
{
	static const
		fmt_str0[] = "Администратор %s[%d] выпустил Вас из тюрьмы",
		fmt_str1[] = "[A] %s[%d] выпустил из тюрьмы игрока %s[%d]";
    new
		str0[sizeof fmt_str0 + 42 + MAX_PLAYER_NAME],
		str1[sizeof fmt_str1 + 41 + MAX_PLAYER_NAME*2];
	if(p_info[playerid][p_admin] < 3) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /unjail [id игрока]");
	if(p_info[params[0]][p_jail] == 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "У игрока не имеется срока!");
	format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], playerid);
	SendClientMessage(params[0], 0x33CC00AA, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0]);
	SendAdminMessage(COLOR_LIGHTGREY, str1);
	p_info[params[0]][p_jail] = 0;
	SpawnPlayer(params[0]);
	return true;
}

CMD:ban(playerid, params[])
{
    static const
		fmt_str0[] = "Администратор %s забанил игрока %s на %d дней. Причина: %s",
		fmt_str1[] = "INSERT INTO `accounts_ban` (admin, player, ban_data, unban_data, reason) VALUES ('%s', '%s', '%s', %d, '%s')";
	new
	    str0[sizeof fmt_str0 + 555],
	    str1[sizeof fmt_str1 + 555],
	    data[50], unbandate, year, month, day, hour, minuite, second;
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "dds[128]", params[0], params[1], params[2])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /ban [id игрока] [кол-во дней] [причина]");
    if(params[1] > 30 || params[1] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Время бана от 1 до 30 дней");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    getdate(year, month, day);
	gettime(hour, minuite, second);
    format(data, 50, "%04d-%02d-%02d %02d:%02d:%02d", year, month, day, hour, minuite, second);
    unbandate = gettime() + params[1]*86400;
	format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], p_info[params[0]][p_name], params[1], params[2]);
	SendClientMessageToAll(COLOR_RED, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[playerid][p_name], p_info[params[0]][p_name], data, unbandate, params[2]);
	mysql_function_query(database, str1, false, "", "");
	KickEx(params[0]);
	return true;
}

CMD:msg(playerid, params[])
{
    static const fmt_str[] = "Администратор %s: %s";
    new str[sizeof fmt_str + 16 + MAX_PLAYER_NAME + 50];
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "s[50]", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /msg [текст]");
    format(str, sizeof(str), fmt_str, p_info[playerid][p_name], params[0]);
	SendClientMessageToAll(0xEAC700AA, str);
	return true;
}

CMD:okay(playerid, params[])
{
	new mysql_str[256];
    static const fmt_str[] = "%s сменил(а) имя на %s";
    new str[sizeof fmt_str + 18 + MAX_PLAYER_NAME*2];
    static fmt_str1[] = "UPDATE `accounts` SET `name` = '%e' WHERE `name` = '%e'";
    new str1[sizeof fmt_str1 + 55 + MAX_PLAYER_NAME*2];
	if(p_info[playerid][p_admin] < 4) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /okay [id игрока]");
	if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	if(!GetPVarInt(params[0], "changename")) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Игрок не отправлял заявку на смену никнэйма!");
	GetPVarString(params[0], "changename_str", mysql_str, MAX_PLAYER_NAME);
	format(str, sizeof(str), fmt_str, p_info[params[0]][p_name], mysql_str);
	SendClientMessageToAll(0xCCFF00AA, str);
	mysql_format(database, str1, sizeof(str1), fmt_str1, mysql_str, p_info[params[0]][p_name]);
	mysql_function_query(database, str1, false, "", "");
	SetPlayerName(params[0], mysql_str),
	GetPlayerName(params[0], p_info[params[0]][p_name], MAX_PLAYER_NAME),
	DeletePVar(params[0], "changename_str"),
	DeletePVar(params[0], "changename");
	return true;
}

CMD:ears(playerid, params[])
{
    if(p_info[playerid][p_admin] < 4) return true;
	if(watch_pm == true)
	{
		SendClientMessage(playerid, 0xbd0606AA, "Режим прослушки SMS выключен");
		watch_pm = false;
	}
	else
	{
		SendClientMessage(playerid, 0x66cc00AA, "Режим прослушки SMS включён");
		watch_pm = true;
	}
	return true;
}

CMD:skin(playerid, params[])
{
	static const
		fmt_str0[] = "Администратор %s[%d] выдал Вам временный скин",
	    fmt_str1[] = "Вы выдали игроку %s[%d] временный скин [%d]";
	new
		str0[sizeof fmt_str0 + 44 + MAX_PLAYER_NAME],
		str1[sizeof fmt_str1 + 43 + MAX_PLAYER_NAME];
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "dd", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /skin [id игрока] [id скина (1-311)]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    if(params[1] > 311 || params[1] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /skin [id игрока] [id скина (1-311)]");
    if(params[1] == 74) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /skin [id игрока] [id скина (1-311)]");
	format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name], playerid);
	SendClientMessage(params[0], -1, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[params[0]][p_name], params[0], params[1]);
	SendClientMessage(playerid, -1, str1);
	SetPlayerSkin(params[0], params[1]);
    return true;
}

CMD:settime(playerid, params[])
{
	static const fmt_str[] = "Установлено время: %i:00";
	new str[sizeof fmt_str + 24];
	if(p_info[playerid][p_admin] < 4) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /settime [время (0-23)]");
	if(params[0] > 23 || params[0] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /settime [время (0-23)]");
	SetWorldTime(params[0]);
	format(str, sizeof(str), fmt_str, params[0]);
	SendClientMessage(playerid, 0x33CC00AA, str);
	return true;
}

CMD:setweather(playerid, params[])
{
	static const fmt_str[] = "Установлена погода №%d";
	new str[sizeof fmt_str + 23];
	if(p_info[playerid][p_admin] < 4) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setweather [погода (0-45)]");
	if(params[0] > 45 || params[0] < 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setweather [погода (0-45)]");
	SetWeather(params[0]);
	format(str, sizeof(str), fmt_str, params[0]);
	SendClientMessage(playerid, 0x33CC00AA, str);
	return true;
}

CMD:hpall(playerid, params[])
{
	new
	    Float: position[3];
	if(p_info[playerid][p_admin] < 4) return true;
	if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /hpall [рудиус]");
	if(params[0] > 80 || params[0] < 5) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Радиус от 5 до 80.");
	GetPlayerPos(playerid, position[0], position[1], position[2]);
	foreach(new i: Player)
	{
	    SendClientMessage(i, -1, "Администратор восстановил Вам здаровье");
	    SetPlayerHealth(i, 100.00);
	}
	SendClientMessage(playerid, 0x00FF00AA, "Всем игрокам в данном радиусе было восстановлено здаровье");
    return true;
}

CMD:hp(playerid, params[])
{
	static const
		fmt_str0[] = "Администратор %s изменил Вам здоровье",
		fmt_str1[] = "Вы выдали игроку %s[%d] здоровье [%d]";
	new
		str0[sizeof fmt_str0 + 35 + MAX_PLAYER_NAME],
		str1[sizeof fmt_str1 + 37 + MAX_PLAYER_NAME];
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "dd", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /hp [id игрока] [здоровье]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    if(params[1] > 100 || params[1] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /hp [id игрока] [здоровье]");
    format(str0, sizeof(str0), fmt_str0, p_info[playerid][p_name]);
    SendClientMessage(params[0], -1, str0);
	format(str1, sizeof(str1), fmt_str1, p_info[params[0]][p_name], params[0], params[1]);
    SendClientMessage(params[0], -1, str1);
    SetPlayerHealth(params[0], params[1]);
    return true;
}

CMD:settp(playerid, params[])
{
	static const
		fmt_str0[] = "[A] %s[%d] установил точку телепорта для игроков. {0abf12}ТП включен.",
		fmt_str1[] = "[A] %s[%d] удалил точку телепорта для игроков. {c16e38}ТП отключен.";
	new
		str[sizeof fmt_str0 + 67 + MAX_PLAYER_NAME], Float: position[3];
    if(p_info[playerid][p_admin] < 4) return true;
   	if(teleport_the_event == 0)
    {
        GetPlayerPos(playerid, position[0], position[1], position[2]);
        SetPVarFloat(playerid, "position_event_x", position[0]), SetPVarFloat(playerid, "position_event_y", position[1]), SetPVarFloat(playerid, "position_event_z", position[2]);
		SetPVarInt(playerid, "virtualworld_event", GetPlayerVirtualWorld(playerid)), SetPVarInt(playerid, "interior_event", GetPlayerInterior(playerid));
        teleport_the_event = 1;
        format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid);
        SendAdminMessage(0x50b0afff, str);
    }
    else
    {
        format(str, sizeof(str), fmt_str1, p_info[playerid][p_name], playerid);
        SendAdminMessage(0x50b0afff, str);
        teleport_the_event = 0;
        return true;
    }
    return true;
}

CMD:gm(playerid, params[])
{
	new
	    Float: position[3];
    if(p_info[playerid][p_admin] < 4) return true;
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /gm [id игрока]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	GetPlayerHealth(params[0], health_godmod_test);
	GetPlayerPos(params[0], position[0], position[1], position[2]);
	CreateExplosion(position[0], position[1], position[2] - 2.5, 12, 0.5);
	SetTimerEx("OnPlayerGodModTest", 200, 0, "ddf", params[0], playerid, health_godmod_test);
	return true;
}

CMD:unban(playerid, params[])
{
	static const fmt_str[] = "SELECT * FROM `accounts_ban` WHERE `name` = '%s'";
	new
		str[sizeof fmt_str + 555],
	    name[MAX_PLAYER_NAME];
	if(p_info[playerid][p_admin] < 4) return true;
	if(sscanf(params, "s", name)) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /unban [ник игрока]");
	format(str, sizeof(str), fmt_str, name);
	mysql_function_query(database, str, true, "OnPlayerUnban", "ds", playerid, name);
	return true;
}

CMD:gzcolor(playerid, params[])
{
    if(!strcmp(p_info[playerid][p_name], ""NAME_DEVELOPER_ONE"", true))
    if(sscanf(params, "d", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /gzcolor [id банды]");
    for(new i = 0; i != sizeof(gz_info); i++)
    {
        if(OnSquared(playerid, gz_info[i][gz_coords][0], gz_info[i][gz_coords][1], gz_info[i][gz_coords][2], gz_info[i][gz_coords][3]))
        {
            if(gz_info[i][gz_gang] == params[0]) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Данная территория принадлежит уже этой банде!");
            gz_info[i][gz_gang] = params[0];
            GangZoneStopFlashForAll(gz_info[i][gz_id]);
            GangZoneHideForAll(gz_info[i][gz_id]);
            GangZoneShowForAll(gz_info[i][gz_id], OnGZColor(params[0]));
            gangzone[0] = 0, gangzone[1] = 0, gangzone[2] = 0, gangzone[3] = 0, gangzone[4] = 0;
            for(new b = 0; b < sizeof(gz_info); b++)
            {
                switch(gz_info[b][gz_gang])
                {
		            case 1: gangzone[0]++;
		            case 2: gangzone[1]++;
		            case 3: gangzone[2]++;
		            case 4: gangzone[3]++;
		            case 5: gangzone[4]++;
                }
            }
            OnGZSave(gz_info[i][gz_id]);
            return true;
        }
    }
    return true;
}

CMD:setadmin(playerid, params[])
{
	static const fmt_str0[] = "[A] %s[%d] назначил %s[%d] на пост администратора %s уровня";
	static fmt_str1[] = "UPDATE accounts SET `admin` = '%s' WHERE `name` = '%e'";
	new
		str[sizeof fmt_str0 + 56 + MAX_PLAYER_NAME*2],
		mysql_str[sizeof fmt_str1 + 54 + 11 + MAX_PLAYER_NAME];
    if(!strcmp(p_info[playerid][p_name], ""NAME_DEVELOPER_ONE"", true))
    if(sscanf(params, "dd", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setadmin [id игрока] [уровень администрирования (1-5)]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    if(params[1] > 5 || params[1] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setadmin [id игрока] [уровень администрирования (1-5)]");
    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0], params[1]);
    SendAdminMessage(COLOR_RED, str);
    p_info[params[0]][p_admin] = params[1];
	mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str1, params[1], p_info[params[0]][p_name]);
 	mysql_tquery(database, mysql_str, "", "");
    return true;
}

CMD:setvip(playerid, params[])
{
	static const fmt_str0[] = "[A] %s[%d] выдал %s[%d] VIP %s уровня";
	static fmt_str1[] = "UPDATE accounts SET `vip` = '%s' WHERE `name` = '%e'";
	new
		str[sizeof fmt_str0 + 56 + MAX_PLAYER_NAME*2],
		mysql_str[sizeof fmt_str1 + 54 + 11 + MAX_PLAYER_NAME];
    if(!strcmp(p_info[playerid][p_name], ""NAME_DEVELOPER_ONE"", true))
    if(sscanf(params, "dd", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setvip [id игрока] [уровень vip (0-3)]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
    if(params[1] > 3 || params[1] < 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setvip [id игрока] [уровень vip (0-3)]");
    format(str, sizeof(str), fmt_str0, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0], params[1]);
    SendAdminMessage(COLOR_RED, str);
    p_info[params[0]][p_vip] = params[1];
	mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str1, params[1], p_info[params[0]][p_name]);
 	mysql_tquery(database, mysql_str, "", "");
    return true;
}

CMD:setscore(playerid, params[])
{
    if(p_info[playerid][p_admin] < 5) return true;
	if(set_score == true)
	{
	    static const fmt_str[] = "[A] %s[%d] выдал %s[%d] убийства: %s";
		new str[sizeof fmt_str + 35 + MAX_PLAYER_NAME*2];
	    if(sscanf(params, "dd", params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setscore [id игрока] [кол-во убийств (1-100)]");
	    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	    if(params[1] > 100 || params[1] < 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /setscore [id игрока] [кол-во убийств (1-100)]");
	    format(str, sizeof(str), fmt_str, p_info[playerid][p_name], playerid, p_info[params[0]][p_name], params[0], params[1]);
    	SendAdminMessage(COLOR_RED, str);
	    p_info[params[0]][p_kills] += params[1];
	    SetPlayerScore(params[0], p_info[params[0]][p_kills]);
		OnPlayerAccountSave(params[0]);
	    return true;
	}
	else
	{
	    SendClientMessage(playerid, COLOR_DARKORANGE, "Администратор "NAME_DEVELOPER_ONE" отключил выдачу убийств!");
	}
	return true;
}

CMD:apanel(playerid, params)
{
    if(!strcmp(p_info[playerid][p_name], ""NAME_DEVELOPER_ONE"", true))
	OnServerSettingShow(playerid);
    return true;
}

CMD:arang(playerid, params[])
{
    static fmt_str[] = "UPDATE accounts SET `admin` = '%s' WHERE `name` = '%e'";
    new mysql_str[sizeof fmt_str + 54 + 11 + MAX_PLAYER_NAME];
    if(p_info[playerid][p_admin] < 5) return true;
    if(sscanf(params, "ds[11]", params[0], params[1])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Используйте /arang [id игрока] [+/-]");
    if(!IsPlayerConnected(params[0])) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Такого игрока нет!");
	if(p_info[params[0]][p_admin] == 0) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Данный игрок не администратор!");
    if(strcmp(params[1], "+", true) == 0)
	{
        if(p_info[params[0]][p_admin] >= 4) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Нельзя повысить администратора выше 4 уровня!");
		SendClientMessage(params[0], COLOR_YELLOW, "Ваш уровень администратора был изменён");
        p_info[params[0]][p_admin] ++;
	}
	if(strcmp(params[1], "-", true) == 0)
	{
	    if(p_info[params[0]][p_admin] == 1) return SendClientMessage(playerid, COLOR_LIGHTGREY, "Нельзя понизить администратора ниже 1 уровня!");
	    SendClientMessage(params[0], COLOR_YELLOW, "Ваш уровень администратора был изменён");
	    p_info[params[0]][p_admin] --;
	}
	mysql_format(database, mysql_str, sizeof(mysql_str), fmt_str, params[1], p_info[params[0]][p_name]);
 	mysql_tquery(database, mysql_str, "", "");
	return true;
}
