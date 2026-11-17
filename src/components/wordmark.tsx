import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// The logo's wordmark: the stepped N of the app icon, then "otch" in Inter
// ExtraBold, as outlines so no font is needed. Its cap height is the N's tall
// stem and its x-height the short one. The same artwork is in assets/: the icon,
// splash and store graphics.
const outline =
  'M0 72V18H18L48 48V0H66V72H48L18 42V72Z M100.4 73Q91.9 73 85.8 69.5Q79.7 66 76.5 59.8Q73.2 53.5 73.2 45.2Q73.2 36.8 76.5 30.6Q79.7 24.3 85.8 20.8Q91.9 17.3 100.4 17.3Q108.8 17.3 114.9 20.8Q121 24.3 124.2 30.6Q127.5 36.8 127.5 45.2Q127.5 53.5 124.2 59.8Q121 66 114.9 69.5Q108.8 73 100.4 73ZM100.4 60.1Q103.6 60.1 105.8 58.2Q108 56.3 109.2 53Q110.3 49.6 110.3 45.1Q110.3 40.6 109.2 37.2Q108 33.9 105.8 32Q103.6 30.2 100.4 30.2Q97.1 30.2 94.9 32Q92.7 33.9 91.5 37.2Q90.4 40.6 90.4 45.1Q90.4 49.6 91.5 53Q92.7 56.3 94.9 58.2Q97.1 60.1 100.4 60.1Z M163.7 18V30.5H130V18ZM137.1 5.1H154V55.5Q154 57.6 155 58.6Q156 59.7 158.3 59.7Q159.2 59.7 160.7 59.5Q162.3 59.3 163 59.1L165.2 71.4Q162.3 72.2 159.6 72.5Q157 72.8 154.6 72.8Q146 72.8 141.6 68.7Q137.1 64.7 137.1 57Z M194.5 73Q186 73 179.9 69.5Q173.9 66 170.6 59.8Q167.3 53.5 167.3 45.2Q167.3 36.8 170.6 30.6Q173.9 24.3 179.9 20.8Q186 17.3 194.5 17.3Q199.7 17.3 204 18.7Q208.3 20 211.5 22.5Q214.7 25 216.7 28.5Q218.7 32.1 219.4 36.5L203.8 39.1Q203.4 37 202.6 35.3Q201.8 33.7 200.7 32.5Q199.6 31.4 198 30.8Q196.5 30.2 194.7 30.2Q191.4 30.2 189.2 32Q186.9 33.7 185.7 37.1Q184.5 40.4 184.5 45.1Q184.5 49.7 185.7 53.1Q186.9 56.5 189.2 58.3Q191.4 60.1 194.7 60.1Q196.6 60.1 198.1 59.5Q199.6 58.9 200.7 57.7Q201.9 56.5 202.7 54.8Q203.5 53.1 203.9 50.9L219.4 53.4Q218.8 58 216.8 61.6Q214.8 65.2 211.5 67.7Q208.3 70.3 204 71.7Q199.7 73 194.5 73Z M243.2 41.2V72H226.3V0H242.9V31.6H241.8Q243.8 25.2 248 21.2Q252.2 17.3 259.4 17.3Q265 17.3 269.2 19.8Q273.5 22.3 275.8 26.9Q278.1 31.5 278.1 37.6V72H261.2V40.9Q261.2 36.3 258.9 33.8Q256.6 31.2 252.4 31.2Q249.7 31.2 247.6 32.4Q245.5 33.5 244.4 35.8Q243.2 38 243.2 41.2Z';
const outlineWidth = 278.09;
const outlineHeight = 73.1;

type Props = {
  // The letters' cap height, which is the height of the N.
  height: number;
  color: string;
};

export function Wordmark({ height, color }: Props) {
  // The round letters dip just below the baseline.
  const drawnHeight = (height * outlineHeight) / 72;
  const width = (drawnHeight * outlineWidth) / outlineHeight;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Notch"
      style={{ width, height: drawnHeight }}
    >
      <Svg width={width} height={drawnHeight} viewBox={`0 0 ${outlineWidth} ${outlineHeight}`}>
        <Path fill={color} d={outline} />
      </Svg>
    </View>
  );
}
