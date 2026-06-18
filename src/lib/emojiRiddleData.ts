export interface EmojiRiddle {
  emojis: string;
  answer: string;
  /** plausible decoys */
  decoys: [string, string, string];
}

/** Emoji → movie / phrase puzzles. Kept broadly recognizable. */
export const EMOJI_RIDDLES: EmojiRiddle[] = [
  { emojis: "🦁👑", answer: "The Lion King", decoys: ["Jungle Book", "Madagascar", "Zootopia"] },
  { emojis: "🕷️🧑", answer: "Spider-Man", decoys: ["Ant-Man", "Batman", "Iron Man"] },
  { emojis: "❄️⛄👸", answer: "Frozen", decoys: ["Tangled", "Moana", "Brave"] },
  { emojis: "🐠🔍", answer: "Finding Nemo", decoys: ["Shark Tale", "The Little Mermaid", "Moana"] },
  { emojis: "🚢🧊💔", answer: "Titanic", decoys: ["The Notebook", "Poseidon", "Life of Pi"] },
  { emojis: "👻🚫", answer: "Ghostbusters", decoys: ["Casper", "Beetlejuice", "Monster House"] },
  { emojis: "🧙‍♂️💍🌋", answer: "Lord of the Rings", decoys: ["Harry Potter", "Narnia", "The Hobbit"] },
  { emojis: "🦖🏝️", answer: "Jurassic Park", decoys: ["King Kong", "Godzilla", "The Lost World"] },
  { emojis: "🤖❤️🌱", answer: "WALL-E", decoys: ["Big Hero 6", "Transformers", "The Iron Giant"] },
  { emojis: "🎈🏠👴", answer: "Up", decoys: ["Toy Story", "Coco", "Onward"] },
  { emojis: "🐭🍳👨‍🍳", answer: "Ratatouille", decoys: ["Cinderella", "Chef", "Burnt"] },
  { emojis: "🦇🦸‍♂️🌃", answer: "Batman", decoys: ["Spider-Man", "Superman", "Daredevil"] },
  { emojis: "🌪️🏠👠", answer: "The Wizard of Oz", decoys: ["Alice in Wonderland", "Twister", "Coraline"] },
  { emojis: "🐢🥷🍕", answer: "Ninja Turtles", decoys: ["Kung Fu Panda", "Big Hero 6", "Karate Kid"] },
  { emojis: "🚗⚡🏁", answer: "Cars", decoys: ["Turbo", "Speed Racer", "Need for Speed"] },
  { emojis: "🐝🎬", answer: "Bee Movie", decoys: ["Antz", "A Bug's Life", "The Ant Bully"] },
  { emojis: "🍫🏭🎫", answer: "Charlie and the Chocolate Factory", decoys: ["Wonka", "Matilda", "Hansel & Gretel"] },
  { emojis: "🦈🌊😱", answer: "Jaws", decoys: ["The Meg", "Deep Blue Sea", "47 Meters Down"] },
  { emojis: "👽📞🏠", answer: "E.T.", decoys: ["Lilo & Stitch", "Paul", "Home"] },
  { emojis: "🃏🦇🌃", answer: "The Dark Knight", decoys: ["Joker", "Suicide Squad", "V for Vendetta"] },
];
