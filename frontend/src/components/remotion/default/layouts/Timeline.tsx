import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const Timeline: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  timelineItems = [],
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const titleSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1 },
  });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  
  // Global line height animation, common for all vertical lines
  const lineH = interpolate(frame, [15, 80], [0, 100], {
    extrapolateRight: "clamp",
  });

  // Determine number of columns and split items
  // If there are more than 4 timeline items, split them into 2 columns.
  // Otherwise, display them in a single column.
  const totalItems = timelineItems.length;
  const numColumns = totalItems > 4 ? 2 : 1;
  const columnItems: typeof timelineItems[] = Array.from({ length: numColumns }, () => []);

  if (numColumns === 1) {
    columnItems[0] = timelineItems;
  } else {
    // Distribute items as evenly as possible among columns
    const itemsPerColumn = Math.ceil(totalItems / numColumns);
    for (let i = 0; i < totalItems; i++) {
      const colIndex = Math.floor(i / itemsPerColumn);
      // Ensure colIndex does not exceed available columns
      if (columnItems[colIndex]) {
        columnItems[colIndex].push(timelineItems[i]);
      } else {
        // Fallback for uneven distribution if totalItems is not a multiple of numColumns
        // Should ideally not happen with Math.ceil for itemsPerColumn logic
        columnItems[columnItems.length - 1].push(timelineItems[i]);
      }
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "70px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden", // Ensures content stays within bounds
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: titleFontSize ?? (p ? 64 : 67),
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginTop: 0,
          marginBottom: p ? 30 : 40,
          textAlign: "center",
        }}
      >
        {title}
      </h2>

      {/* Container for all columns of timeline items */}
      <div
        style={{
          display: "flex",
          flexDirection: "row", // Arranges individual columns horizontally
          gap: p ? 60 : 80, // Gap between the columns
          justifyContent: numColumns > 1 ? "center" : "flex-start", // Center columns if multiple, otherwise start
          flex: 1, // Allows this container to take up available vertical space
          overflow: "hidden", // Prevents horizontal scroll if too many columns (though numColumns is max 2 here)
          alignItems: "flex-start", // Align columns to the top
        }}
      >
        {columnItems.map((col, colIndex) => {
          // Calculate the starting overall index for items in this column
          const previousColumnItemsCount = columnItems.slice(0, colIndex).flat().length;

          return (
            <div
              key={colIndex}
              style={{
                display: "flex",
                flexDirection: "column", // Stacks items vertically within this column
                position: "relative",
                paddingLeft: p ? 30 : 40, // Padding for the vertical line and items
                flexShrink: 0, // Prevent columns from shrinking
                // Set a max-height for each column to fit within the available vertical space
                maxHeight: p ? "calc(100% - 20px)" : "calc(100% - 20px)", // 100% of parent's height minus a small buffer
              }}
            >
              {/* Vertical line for this specific column */}
              <div
                style={{
                  position: "absolute",
                  left: p ? 10 : 15,
                  top: 0,
                  width: 2,
                  height: `${lineH}%`, // Line animates to 100% of the column's height
                  backgroundColor: `${accentColor}30`,
                  borderRadius: 1,
                }}
              />

              {col.map((item, i) => {
                // Calculate the overall index of the item across all columns
                const overallIndex = previousColumnItemsCount + i;
                
                // Animation delay for each item, keeping the overall sequence
                const delay = 18 + overallIndex * 12; 
                const itemSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: { damping: 16, stiffness: 120, mass: 1 },
                });
                const op = interpolate(itemSpring, [0, 1], [0, 1], {
                  extrapolateRight: "clamp",
                });
                const x = interpolate(itemSpring, [0, 1], [-30, 0], {
                  extrapolateRight: "clamp",
                });
                const dotScale = interpolate(itemSpring, [0, 0.6], [0, 1], {
                  extrapolateRight: "clamp",
                });
                
                // Determine if this is the very last item in the entire timeline
                const isLastItemOverall = overallIndex === totalItems - 1;

                return (
                  <div
                    key={`${colIndex}-${i}`} // Unique key using column and item index
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: p ? 20 : 28,
                      // Increased marginBottom to add more distance between time lines
                      marginBottom: p ? 40 : 50, 
                      opacity: op,
                      transform: `translateX(${x}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: p ? 24 : 28,
                        height: p ? 24 : 28,
                        borderRadius: "50%",
                        backgroundColor: isLastItemOverall ? accentColor : `${accentColor}20`,
                        border: `2px solid ${accentColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transform: `scale(${dotScale})`,
                        marginLeft: p ? -12 : -14,
                      }}
                    >
                      <span
                        style={{
                          color: isLastItemOverall ? "#FFF" : accentColor,
                          fontSize: p ? 11 : 13,
                          fontWeight: 700,
                        }}
                      >
                        {overallIndex + 1} {/* Display global item number */}
                      </span>
                    </div>
                    <div>
                      <h3
                        style={{
                          fontSize: descriptionFontSize ?? (p ? 41 : 31),
                          fontWeight: 600,
                          color: textColor,
                          fontFamily: "Inter, sans-serif",
                          margin: 0,
                          marginBottom: 4,
                        }}
                      >
                        {item.label}
                      </h3>
                      <p
                        style={{
                          fontSize: descriptionFontSize ?? (p ? 41 : 31),
                          color: textColor,
                          fontFamily: "Inter, sans-serif",
                          opacity: 0.6,
                          margin: 0,
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          backgroundColor: accentColor,
        }}
      />
    </AbsoluteFill>
  );
};
