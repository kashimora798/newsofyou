export interface TriviaQ {
  q: string;
  /** correct answer is always index 0; options are shuffled at runtime */
  options: [string, string, string, string];
}

/** Light, fun, broadly-known trivia. Correct answer first; shuffled per round. */
export const TRIVIA: TriviaQ[] = [
  { q: "How many hearts does an octopus have?", options: ["3", "1", "2", "8"] },
  { q: "What planet is known as the Red Planet?", options: ["Mars", "Venus", "Jupiter", "Mercury"] },
  { q: "What's the largest mammal on Earth?", options: ["Blue whale", "Elephant", "Giraffe", "Hippo"] },
  { q: "How many colors are in a rainbow?", options: ["7", "5", "6", "8"] },
  { q: "What is the fastest land animal?", options: ["Cheetah", "Lion", "Horse", "Gazelle"] },
  { q: "Which fruit keeps the doctor away?", options: ["Apple", "Banana", "Orange", "Grape"] },
  { q: "How many legs does a spider have?", options: ["8", "6", "10", "4"] },
  { q: "What gas do plants breathe in?", options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Helium"] },
  { q: "What's the tallest animal in the world?", options: ["Giraffe", "Elephant", "Horse", "Camel"] },
  { q: "How many minutes are in a full day?", options: ["1440", "1000", "720", "2400"] },
  { q: "Which ocean is the largest?", options: ["Pacific", "Atlantic", "Indian", "Arctic"] },
  { q: "What do bees collect from flowers?", options: ["Nectar", "Water", "Pollen dust", "Sugar"] },
  { q: "How many sides does a hexagon have?", options: ["6", "5", "7", "8"] },
  { q: "What's the hardest natural substance?", options: ["Diamond", "Gold", "Iron", "Quartz"] },
  { q: "Which animal is known as man's best friend?", options: ["Dog", "Cat", "Horse", "Parrot"] },
  { q: "What's frozen water called?", options: ["Ice", "Steam", "Snowball", "Frost"] },
  { q: "How many continents are there?", options: ["7", "5", "6", "8"] },
  { q: "What's the main language spoken in Brazil?", options: ["Portuguese", "Spanish", "English", "French"] },
  { q: "Which bird can't fly?", options: ["Penguin", "Eagle", "Sparrow", "Robin"] },
  { q: "What's the smallest planet in our solar system?", options: ["Mercury", "Mars", "Pluto", "Venus"] },
  { q: "How many strings does a standard guitar have?", options: ["6", "4", "5", "7"] },
  { q: "What color do you get mixing blue and yellow?", options: ["Green", "Purple", "Orange", "Brown"] },
  { q: "Which metal is liquid at room temperature?", options: ["Mercury", "Iron", "Copper", "Tin"] },
  { q: "How many players are on a soccer team on the field?", options: ["11", "9", "10", "12"] },
];
