import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Rules = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 lg:pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">League Rules</h1>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-4 sm:px-0">
              Everything you need to know about Top Tennis League rules and regulations
            </p>
          </div>

          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* About Top Tennis League */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">About Top Tennis League</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  Top Tennis League is one of the largest community tennis programs in the country, with thousands of players competing across cities like Atlanta, Charlotte, and Denver. The league has opportunities for everyone — Men's, Women's, and Mixed Doubles, Singles, Juniors, and even a brand-new High School league for grades 9–12.
                </p>
              </CardContent>
            </Card>

            {/* Levels of Play */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Levels of Play</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  Players are expected to register at a level that ensures fair and competitive matches. Placement is determined by past league results, USTA/Level ratings, or Ultimate Tennis levels. New players should register at their official rating or seek advice from a coach if unsure. Doubles levels are based on a combination of both partners' ratings. Teams with partners more than two levels apart are discouraged. Returning players may move up or down based on past win percentages and overall performance.
                </p>
              </CardContent>
            </Card>

            {/* Junior Divisions */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Junior Divisions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed mb-3 sm:mb-4">
                  Junior players are grouped by age (10U, 12U, 14U) and by level:
                </p>
                <ul className="space-y-2 sm:space-y-3 ml-4 sm:ml-6">
                  <li className="text-sm sm:text-base lg:text-lg text-foreground"><strong>A:</strong> Advanced players with significant tournament experience</li>
                  <li className="text-sm sm:text-base lg:text-lg text-foreground"><strong>B:</strong> Intermediate players with league experience</li>
                  <li className="text-sm sm:text-base lg:text-lg text-foreground"><strong>C:</strong> Beginners building skills and match experience</li>
                </ul>
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed mt-3 sm:mt-4">
                  Players with high win percentages typically move up in age or skill level. Junior divisions do not include playoffs.
                </p>
              </CardContent>
            </Card>

            {/* Scheduling Matches */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Scheduling Matches</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  Both teams are responsible for contacting each other by Wednesday of the match week to set a time. Each side must offer three valid options within league hours. If no agreement is reached, the match defaults to the "play by" date at the set time. Matches can be rescheduled once with proper notice, but repeated cancellations or forfeits may result in penalties. A one-time "late score pass" can be used to extend certain matches past the deadline (except the final match or playoffs).
                </p>
              </CardContent>
            </Card>

            {/* Match Play Rules */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Match Play Rules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  Matches follow USTA rules, with Top Tennis League guidelines taking priority. Home teams provide courts and a new can of USTA-approved balls. Adults and high school players usually play best two out of three sets, with the option to replace a third set with a tiebreaker if agreed. Juniors always use a 7-point tiebreaker in the third set. Standard rules apply for warm-ups, breaks, sportsmanship, and cell phone use. Spectators are welcome but may not interfere. Scores must be reported before the deadline.
                </p>
              </CardContent>
            </Card>

            {/* Playoffs & Division Winners */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Playoffs & Division Winners</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  Teams must "opt in" to qualify for playoffs. Division winners qualify automatically if they meet eligibility requirements (sufficient points, limited forfeits). Playoff scheduling is stricter, and late passes are not permitted. Division winners are decided by points and game-winning percentage, with winners receiving recognition items such as bag tags and magnets.
                </p>
              </CardContent>
            </Card>

            {/* Weather & Special Rules */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Weather & Special Rules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  In cases of rain, extreme heat, or freezing conditions, matches may be rescheduled. Lightning requires a 30-minute suspension before play can resume. The home team is responsible for ensuring safe courts, proper lighting, and restroom access. If a match is interrupted after it begins, play resumes from the exact score when it stopped.
                </p>
              </CardContent>
            </Card>

            {/* Waiver & Player Responsibility */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">Waiver & Player Responsibility</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">
                  By registering, all participants accept the risks of competitive tennis and release Top Tennis League and its host facilities from liability for injuries or damages. Players are expected to honor their commitments, respect opponents, and maintain good sportsmanship both on and off the court.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Rules;