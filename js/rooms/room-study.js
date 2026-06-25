// room-study
export const room_study = {
    size: {
    width: 8,
    depth: 8,
    height: 3.5
  },
    walls: [
    {
      type: "door",
      facing: "north",
      door: {
        width: 1.2,
        height: 2.4,
        openDirection: "left"
      }
    },
    {
      type: "window",
      facing: "south",
      window: {
        width: 5,
        sillHeight: 0.25,
        topHeight: 3.5
      }
    },
    {
      type: "solid",
      facing: "east"
    },
    {
      type: "door",
      facing: "west",
      door: {
        width: 1.2,
        height: 2.4,
        openDirection: "left"
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
