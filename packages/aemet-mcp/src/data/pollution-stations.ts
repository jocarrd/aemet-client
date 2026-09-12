export interface PollutionStationInfo {
  readonly code: string;
  readonly name: string;
  readonly province: string;
  readonly lat: number;
  readonly lon: number;
  readonly aliases: readonly string[];
}

export const POLLUTION_STATION_TABLE: readonly PollutionStationInfo[] = [
  {
    code: "01",
    name: "San Pablo de los Montes",
    province: "Toledo",
    lat: 39.5469,
    lon: -4.3506,
    aliases: ["san pablo"],
  },
  {
    code: "05",
    name: "Noia",
    province: "A Coruña",
    lat: 42.8003,
    lon: -8.8761,
    aliases: ["noya"],
  },
  {
    code: "06",
    name: "Mahón",
    province: "Illes Balears",
    lat: 39.8894,
    lon: 4.2642,
    aliases: ["maó", "menorca"],
  },
  {
    code: "07",
    name: "Víznar",
    province: "Granada",
    lat: 37.2369,
    lon: -3.5506,
    aliases: [],
  },
  {
    code: "08",
    name: "Niembro",
    province: "Asturias",
    lat: 43.4203,
    lon: -4.7481,
    aliases: ["llanes", "niembro llanes"],
  },
  {
    code: "09",
    name: "Campisábalos",
    province: "Guadalajara",
    lat: 41.2672,
    lon: -3.1456,
    aliases: [],
  },
  {
    code: "10",
    name: "Cabo de Creus",
    province: "Girona",
    lat: 42.3192,
    lon: 3.3156,
    aliases: ["cap de creus"],
  },
  {
    code: "11",
    name: "Barcarrota",
    province: "Badajoz",
    lat: 38.4728,
    lon: -6.9233,
    aliases: [],
  },
  {
    code: "12",
    name: "Zarra",
    province: "Valencia",
    lat: 39.0831,
    lon: -1.1011,
    aliases: [],
  },
  {
    code: "13",
    name: "Peñausende",
    province: "Zamora",
    lat: 41.2389,
    lon: -5.8975,
    aliases: [],
  },
  {
    code: "14",
    name: "Els Torms",
    province: "Lleida",
    lat: 41.3939,
    lon: 0.7347,
    aliases: ["los tormos"],
  },
  {
    code: "16",
    name: "O Saviñao",
    province: "Lugo",
    lat: 42.6449,
    lon: -7.6395,
    aliases: ["saviñao"],
  },
  {
    code: "17",
    name: "Doñana",
    province: "Huelva",
    lat: 37.2612,
    lon: -6.5176,
    aliases: ["almonte"],
  },
];
