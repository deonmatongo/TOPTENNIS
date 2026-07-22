import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Clock, Users, MessageCircle } from "lucide-react";

const Contact = () => {
  const contactInfo = [
    {
      icon: <Mail className="h-6 w-6" />,
      title: "Email",
      details: "support@toptennisleague.com",
      subtitle: "We respond within 24 hours"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Hours",
      details: "Mon–Fri: 9AM–6PM ET",
      subtitle: "Sat–Sun: 10AM–4PM ET"
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      title: "In-App Support",
      details: "Help & Feedback",
      subtitle: "Available in the app settings"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Community",
      details: "Player Forums",
      subtitle: "Connect with other players"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white overflow-x-hidden">
      <Header />
      <div className="container mx-auto px-4 pt-24 pb-12 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-24">
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

        {/* Support note */}
        <div className="mt-12">
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-orange-900">App Support</h4>
                  <p className="text-orange-700">
                    For help with the Top Tennis app, email <strong>support@toptennisleague.com</strong> or use the Help section inside the app.
                  </p>
                  <p className="text-orange-600 text-sm mt-1">We aim to respond within one business day.</p>
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