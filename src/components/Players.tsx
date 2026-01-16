
import { Button } from "@/components/ui/button";

const Players = () => {
  const players = [{
    name: "SARAH MARTINEZ",
    description: "4.0 level player with 8 years of competitive experience. Looking for doubles partners and competitive singles matches in the metro area.",
    image: "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1169&q=80"
  }, {
    name: "MIKE RODRIGUEZ",
    description: "3.5 level player who loves the game and is always up for a friendly match. Available weekday evenings and weekend mornings.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
  }, {
    name: "EMMA THOMPSON",
    description: "Tournament player (4.5 level) seeking challenging matches and practice partners. Specializes in singles play with strong baseline game.",
    image: "https://images.unsplash.com/photo-1494790108755-2616c04fc6c5?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
  }, {
    name: "ALEX CHEN",
    description: "Experienced player (4.0 level) who enjoys both casual and competitive play. Great for players wanting to improve their game through matches.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80"
  }];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Featured Players</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {players.map((player, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
              <img 
                src={player.image} 
                alt={player.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2">{player.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{player.description}</p>
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Connect
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Players;
