import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Clock, Users, MessageCircle } from "lucide-react";

const Contact = () => {
  const contactInfo = [
    {
      icon: <Phone className="h-6 w-6" />,
      title: "Phone",
      details: "(555) 123-TENNIS",
      subtitle: "Call us during business hours"
    },
    {
      icon: <Mail className="h-6 w-6" />,
      title: "Email", 
      details: "info@toptennisleague.com",
      subtitle: "We respond within 24 hours"
    },
    {
      icon: <MapPin className="h-6 w-6" />,
      title: "Address",
      details: "123 Tennis Boulevard",
      subtitle: "Sports District, TC 12345"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Hours",
      details: "Mon-Fri: 8AM-8PM",
      subtitle: "Sat-Sun: 9AM-6PM"
    }
  ];

  const team = [
    {
      name: "Sarah Johnson",
      role: "League Director",
      phone: "(555) 123-4567",
      email: "sarah@toptennisleague.com",
      specialization: "League Operations & Player Relations"
    },
    {
      name: "Mike Rodriguez", 
      role: "Tournament Coordinator",
      phone: "(555) 234-5678",
      email: "mike@toptennisleague.com",
      specialization: "Match Scheduling & Results"
    },
    {
      name: "Emily Chen",
      role: "Membership Manager",
      phone: "(555) 345-6789", 
      email: "emily@toptennisleague.com",
      specialization: "New Member Registration & Support"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white overflow-x-hidden">
      <Header />
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-24">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">Contact Us</h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Get in touch with our team. We're here to help with leagues, tournaments, and everything tennis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
          {/* Contact Form */}
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Send us a Message</span>
                </CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you as soon as possible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" placeholder="Enter your first name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" placeholder="Enter your last name" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Enter your email address" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input id="phone" type="tel" placeholder="Enter your phone number" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="What is this about?" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Tell us how we can help you..."
                    className="min-h-[120px]"
                  />
                </div>
                
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            {/* Quick Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Multiple ways to reach us for any questions or support.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {contactInfo.map((info, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                        {info.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{info.title}</h4>
                        <p className="text-gray-700 font-medium">{info.details}</p>
                        <p className="text-sm text-gray-500">{info.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team Directory */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Our Team</span>
                </CardTitle>
                <CardDescription>
                  Connect directly with our team members for specific needs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {team.map((member, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                    <h4 className="font-semibold text-gray-900">{member.name}</h4>
                    <p className="text-orange-600 font-medium text-sm">{member.role}</p>
                    <p className="text-gray-600 text-sm mt-1">{member.specialization}</p>
                    <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-1 sm:space-y-0 mt-2 text-sm">
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">{member.phone}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">{member.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* FAQ Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>
                  Quick answers to common questions about our leagues.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start text-left h-auto py-3">
                    <div>
                      <div className="font-medium">How do I register for a league?</div>
                      <div className="text-sm text-gray-500">Registration process and requirements</div>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-left h-auto py-3">
                    <div>
                      <div className="font-medium">What skill levels do you accept?</div>
                      <div className="text-sm text-gray-500">Beginner to advanced levels welcome</div>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-left h-auto py-3">
                    <div>
                      <div className="font-medium">How are matches scheduled?</div>
                      <div className="text-sm text-gray-500">Flexible scheduling system</div>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-left h-auto py-3">
                    <div>
                      <div className="font-medium">What are the league fees?</div>
                      <div className="text-sm text-gray-500">Pricing and payment options</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="mt-12">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-red-900">Emergency Contact</h4>
                  <p className="text-red-700">
                    For urgent matters during tournaments or events: <strong>(555) 911-TENNIS</strong>
                  </p>
                  <p className="text-red-600 text-sm mt-1">Available during event hours only</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Contact;