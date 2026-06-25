// room-living
export const room_living = {
    size: {
    width: 16,
    depth: 8,
    height: 3.5
  },
    walls: [
    {
      type: "doorWindow",
      facing: "south",
      window: {
        width: 3.5,
        sillHeight: 0.25,
        topHeight: 3.5,
        offset: -4
      },
      door: {
        width: 2,
        height: 2.4,
        offset: 4,
        openDirection: "left"
      },
      curtain: {
        rodLength: 4.5
      }
    }
  ],
    furniture: [],
    lights: [
    {
      type: "ceilingLight",
      pos: {
        x: 0,
        z: 0
      }
    }
  ],
    decorations: [],
    smallItems: [],
};
