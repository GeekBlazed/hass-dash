export type HouseholdEntityKind = 'temperature' | 'humidity' | 'light';

export type HouseholdAreaId = string;

export interface HouseholdAreaInfo {
  areaId: HouseholdAreaId;
  name?: string;
}

export interface IHouseholdAreaEntityIndexService {
  /**
   * Returns all known Home Assistant areas.
   */
  getAllAreas(): Promise<HouseholdAreaInfo[]>;

  /**
   * Returns the set of device ids labeled "Household" for a given area.
   */
  getHouseholdDeviceIdsByAreaId(areaId: HouseholdAreaId): Promise<Set<string>>;

  /**
   * Returns the set of entity ids associated with Household-labeled devices/entities
   * for a given area and kind.
   */
  getHouseholdEntityIdsByAreaId(
    areaId: HouseholdAreaId,
    kind: HouseholdEntityKind
  ): Promise<Set<string>>;

  /**
   * Forces a refresh of cached registry-derived data.
   */
  refresh(): Promise<void>;
}
