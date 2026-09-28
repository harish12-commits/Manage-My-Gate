export interface InterestCategory {
  id: string;
  name: string;
  iconName: string;
  items: string[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    id: 'sports',
    name: 'Sports',
    iconName: 'Dumbbell',
    items: [
      'Badminton',
      'Cricket',
      'Football',
      'Tennis',
      'Swimming',
      'Running',
      'Gym',
      'Yoga',
      'Cycling',
      'Table Tennis',
      'Basketball',
      'Squash',
    ],
  },
  {
    id: 'tech',
    name: 'Tech',
    iconName: 'Laptop',
    items: [
      'Coding',
      'AI & Robotics',
      'Gadgets',
      'PC Gaming',
      'PlayStation',
      'Mobile Gaming',
      'Web3',
      'Startups',
      'Smart Home',
    ],
  },
  {
    id: 'arts',
    name: 'Arts',
    iconName: 'Palette',
    items: [
      'Photography',
      'Music',
      'Guitar',
      'Painting',
      'Movies',
      'Dancing',
      'Singing',
      'Theatre',
      'Writing',
      'Podcasts',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    iconName: 'Utensils',
    items: [
      'Home Cooking',
      'Baking',
      'Coffee Brewing',
      'Barbecue',
      'Food Tasting',
      'Vegan Cooking',
      'Fine Dining',
    ],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    iconName: 'HeartHandshake',
    items: [
      'Gardening',
      'Reading',
      'Traveling',
      'Pet Care',
      'Board Games',
      'Hiking & Trekking',
      'Meditation',
      'DIY & Crafts',
      'Volunteering',
    ],
  },
];

export const WORK_SUGGESTIONS = [
  'Software Engineer',
  'Consultant',
  'Entrepreneur',
  'Doctor',
  'Architect',
  'Product Designer',
  'Finance Specialist',
  'Teacher / Professor',
  'Product Manager',
  'Chartered Accountant',
  'Civil Engineer',
  'Lawyer',
  'Marketing Director',
  'Freelancer',
  'Researcher',
  'Student',
];

export const BIO_SUGGESTIONS = [
  'Tech enthusiast & avid badminton player.',
  'Passionate about gardening, reading & weekend cycling.',
  'Friendly neighbor in Villa community, reach out anytime!',
  'Foodie, home chef, and pet lover.',
  'Always up for a friendly tennis or cricket match.',
  'Coffee addict, remote worker & photography buff.',
];

export const HOMETOWN_QUICK_SUGGESTIONS = [
  'Bengaluru, Karnataka, India',
  'Dubai, United Arab Emirates',
  'Mumbai, Maharashtra, India',
  'Riyadh, Saudi Arabia',
  'New Delhi, Delhi NCR, India',
  'Abu Dhabi, United Arab Emirates',
  'Hyderabad, Telangana, India',
  'Chennai, Tamil Nadu, India',
  'London, England, United Kingdom',
];
